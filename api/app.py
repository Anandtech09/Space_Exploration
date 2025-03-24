from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import random
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
NASA_API_KEY = os.getenv('VITE_NASA_API_KEY')
GROQ_API_KEY = os.getenv('VITE_GROQ_API_KEY')
WEATHER_BASE_URL = os.getenv('VITE_WEATHER_BASE_URL')
PIXABAY_API_KEY = os.getenv('VITE_PIXABAY_API_KEY')
NEO_FEED_URL = 'https://api.nasa.gov/neo/rest/v1/feed'

# Custom exception for rate limits
class RateLimitError(Exception):
    pass

# Reusable Groq API call function with retry logic
@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=4, max=10), retry=retry_if_exception_type(RateLimitError))
def call_groq_api(payload: Dict) -> str:
    """Make a call to the Groq API with retry logic for rate limits."""
    headers = {
        'Authorization': f'Bearer {GROQ_API_KEY}',
        'Content-Type': 'application/json'
    }
    response = requests.post('https://api.groq.com/openai/v1/chat/completions', json=payload, headers=headers)
    if response.status_code == 429:
        logger.warning("Groq API rate limit exceeded, retrying...")
        raise RateLimitError("Rate limit exceeded")
    elif response.status_code == 400:
        error_detail = response.json().get("error", "Unknown error")
        logger.error(f"Bad Request to Groq API: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Bad Request to Groq API: {error_detail}")
    
    # Log the raw response for debugging
    response_text = response.text
    logger.info(f"Raw response from Groq: {response_text}")
    
    # Attempt to parse the response as JSON
    try:
        response_json = json.loads(response_text)
        return response_json['choices'][0]['message']['content']
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON from Groq: {response_text}")
        raise HTTPException(status_code=500, detail="Invalid JSON from Groq")
    except KeyError:
        logger.error(f"Unexpected response format from Groq: {response_text}")
        raise HTTPException(status_code=500, detail="Unexpected response format from Groq")

# Image fetching with Llama3 and fallback to Pixabay
def fetch_image_with_llama3_or_pixabay(query: str) -> str:
    """Attempt to fetch an image URL using Llama3 via Groq, fall back to Pixabay if unsuccessful."""
    # Try Llama3 first
    payload = {
        'model': 'llama3-8b-8192',
        'messages': [{
            'role': 'user',
            'content': f'''Provide a valid image URL (e.g., starting with http:// or https://) for "{query}". 
            Return only the URL as plain text, no additional formatting or explanations.'''
        }],
        'max_tokens': 256,
        'temperature': 0.5
    }
    try:
        content = call_groq_api(payload)
        content = content.strip()
        if content.startswith('http://') or content.startswith('https://'):
            # Verify the URL is accessible
            response = requests.head(content, timeout=5)
            if response.status_code == 200:
                logger.info(f"Successfully fetched image URL from Llama3 for query: {query}")
                return content
    except Exception as e:
        logger.warning(f"Failed to fetch image URL from Llama3 for query {query}: {str(e)}")

    # Fallback to Pixabay
    pixabay_url = f"https://pixabay.com/api/?key={PIXABAY_API_KEY}&q={query}&image_type=photo&category=science&orientation=horizontal&safesearch=true"
    try:
        response = requests.get(pixabay_url)
        response.raise_for_status()
        data = response.json()
        if 'hits' in data and data['hits']:
            logger.info(f"Successfully fetched image from Pixabay for query: {query}")
            return data['hits'][0]['webformatURL']
        logger.warning(f"No Pixabay images found for query: {query}")
    except requests.RequestException as e:
        logger.error(f"Pixabay API error for query {query}: {str(e)}")
    
    # Final fallback to placeholder
    logger.info(f"Using placeholder image for query: {query}")
    return "https://picsum.photos/seed/picsum/400/225"

# Reusable NASA APOD function
def get_nasa_apod() -> Dict:
    """Fetch NASA's Astronomy Picture of the Day."""
    url = f'https://api.nasa.gov/planetary/apod?api_key={NASA_API_KEY}'
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

# Reusable NEO Feed function
def get_neo_feed(start_date: str, end_date: str) -> Dict:
    """Fetch Near Earth Object data from NASA."""
    params = {'start_date': start_date, 'end_date': end_date, 'api_key': NASA_API_KEY}
    headers = {'User-Agent': 'MyFastAPIApp/1.0 (your.email@example.com)'}
    response = requests.get(NEO_FEED_URL, params=params, headers=headers)
    response.raise_for_status()
    return response.json()

# Endpoint-specific payload functions
def get_astronauts_payload() -> Dict:
    return {
        'model': 'llama3-8b-8192',
        'messages': [{
            'role': 'user',
            'content': '''Generate a detailed list of 20 astronauts with the following information:
            - name (string)
            - nationality (string)
            - space_agency (string, e.g., ISRO, NASA, ESA, Roscosmos, etc.)
            - notable_missions (array of strings)
            - current_status (string, active/retired/deceased)
            Format as a valid JSON array. Ensure the response is only the JSON array with no additional text or explanations outside the array.'''
        }],
        'max_tokens': 4096,
        'temperature': 0.3
    }

def get_search_astronauts_payload(query: str) -> Dict:
    return {
        'model': 'llama3-8b-8192',
        'messages': [{
            'role': 'user',
            'content': f'''Search for astronauts matching the query "{query}" (could be a name, nationality, or space agency). Provide a list of up to 10 astronauts with the following information:
            - name (string)
            - nationality (string)
            - space_agency (string, e.g., ISRO, NASA, ESA, Roscosmos, etc.)
            - notable_missions (array of strings)
            - current_status (string, active/retired/deceased)
            Format as a valid JSON array. Ensure the response is only the JSON array with no additional text or explanations outside the array.'''
        }],
        'max_tokens': 2048,
        'temperature': 0.3
    }

def get_astronaut_details_payload(name: str) -> Dict:
    return {
        'model': 'llama3-8b-8192',
        'messages': [{
            'role': 'user',
            'content': f'''Fetch detailed information about the astronaut {name}. Provide the following details in a valid JSON object:
            {{
                "biography": "A brief biography of the astronaut",
                "firstMission": "Details about their first space mission",
                "family": "Information about their family",
                "additionalInfo": "Any other notable information"
            }}
            Ensure the response is only the JSON object with no additional text or explanations.'''
        }],
        'max_tokens': 2048,
        'temperature': 0.3
    }

def get_missions_payload() -> Dict:
    return {
        'model': 'llama3-8b-8192',
        'messages': [{
            'role': 'user',
            'content': '''Generate a detailed list of 30 space missions with:
            - mission_name (string)
            - organization (string, NASA, ESA, SpaceX, ISRO, etc.)
            - country (string)
            - type (string, current/future/past)
            - start_date (string, e.g., "2023-01-15")
            - end_date (string, e.g., "2023-06-20" or null if ongoing/future)
            - description (string)
            Format as a valid JSON array. Ensure the response is only the JSON array with no additional text or explanations outside the array.'''
        }],
        'max_tokens': 4096,
        'temperature': 0.3
    }

def get_quiz_payload() -> Dict:
    return {
        'model': 'llama3-8b-8192',
        'messages': [{
            'role': 'user',
            'content': '''Generate 10 space-related quiz questions with:
            - question (string, e.g., "What is the closest planet to the Sun?")
            - options (array of 4 strings, e.g., ["Mercury", "Venus", "Earth", "Mars"])
            - correctAnswer (string, e.g., "Mercury")
            - explanation (string, e.g., "Mercury is the closest planet to the Sun, orbiting at an average distance of 58 million kilometers.")
            Cover topics like astronomy, space exploration, and space technology.
            Return the result as a valid JSON array. Ensure the response is only the JSON array with no additional text or explanations outside the array.'''
        }],
        'max_tokens': 2048,
        'temperature': 0.3
    }

def get_spaceflight_data_payload() -> Dict:
    return {
        'model': 'llama3-8b-8192',
        'messages': [{
            'role': 'user',
            'content': '''Generate synthetic spaceflight news data for the years 2020 to 2025. Return a valid JSON object with exactly two fields:
            {{
                "launches_by_year": {{"2020": 10, "2021": 12, "2022": 15, "2023": 18, "2024": 20, "2025": 15}},
                "missions_by_type": {{"Lunar": 20, "Mars": 15, "Earth Observation": 30, "Deep Space": 15}}
            }}
            Ensure the response is only the JSON object with no additional text or explanations.'''
        }],
        'max_tokens': 512,
        'temperature': 0.3
    }

def get_articles_payload(date: Optional[str], query: Optional[str]) -> Dict:
    prompt = f'''Generate a list of 6 space-related articles {"for " + date if date else "matching " + query}.
    Format the output as a JSON array where each object has these exact keys:
    - title (string)
    - summary (string)
    - link (string)
    - date (string in YYYY-MM-DD format)
    The response should be ONLY the JSON array with no other text.'''
    return {
        'model': 'llama3-8b-8192',
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': 1024,
        'temperature': 0.7
    }

# Endpoints
@app.get("/api/nasa/apod")
async def nasa_apod():
    try:
        if not NASA_API_KEY:
            raise HTTPException(status_code=500, detail="NASA API Key is not set")
        data = get_nasa_apod()
        logger.info("Successfully fetched APOD")
        return data
    except Exception as e:
        logger.error(f"Error fetching APOD: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/space-weather")
async def get_space_weather(request: Request):
    try:
        lat = request.headers.get('X-Latitude')
        lon = request.headers.get('X-Longitude')
        if not lon or not lat:
            raise HTTPException(status_code=400, detail="Longitude and Latitude are required")
        url = f"{WEATHER_BASE_URL}?lon={lon}&lat={lat}&ac=0&unit=metric&output=json&tzshift=0"
        response = requests.get(url)
        response.raise_for_status()
        logger.info("Successfully fetched space weather")
        return response.json()
    except Exception as e:
        logger.error(f"Error fetching space weather: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/astronauts")
async def get_astronauts():
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API Key is not set")
        payload = get_astronauts_payload()
        content = call_groq_api(payload)
        if not content or content.strip() == "":
            raise HTTPException(status_code=500, detail="Empty response from Groq")
        content = content.strip()
        if content.startswith('```json'):
            content = content[7:].strip()
        if content.endswith('```'):
            content = content[:-3].strip()
        if content.endswith(','): content = content[:-1]
        if not content.endswith(']'): content += ']'
        if not content.startswith('['): content = '[' + content
        astronauts = json.loads(content)
        if not isinstance(astronauts, list):
            raise HTTPException(status_code=500, detail="Response is not a JSON array")
        for astronaut in astronauts:
            if not all(key in astronaut for key in ['name', 'nationality', 'space_agency', 'notable_missions', 'current_status']):
                raise HTTPException(status_code=500, detail="Invalid astronaut format")
            if not isinstance(astronaut['notable_missions'], list):
                raise HTTPException(status_code=500, detail="Invalid notable_missions format")
            astronaut['name'] = astronaut['name'].strip()
            astronaut['current_status'] = astronaut['current_status'].lower()
            astronaut['image_url'] = fetch_image_with_llama3_or_pixabay(f"{astronaut['name']} astronaut")
        logger.info("Successfully fetched astronauts")
        return astronauts
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON from Groq: {content}")
        raise HTTPException(status_code=500, detail="Invalid JSON from Groq")
    except Exception as e:
        logger.error(f"Error fetching astronauts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class SearchQuery(BaseModel):
    query: str

@app.post("/api/search-astronauts")
async def search_astronauts(query: SearchQuery):
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API Key is not set")
        if not query.query:
            raise HTTPException(status_code=400, detail="Search query is required")
        payload = get_search_astronauts_payload(query.query)
        content = call_groq_api(payload)
        if not content or content.strip() == "":
            raise HTTPException(status_code=500, detail="Empty response from Groq")
        content = content.strip()
        if content.startswith('```json'):
            content = content[7:].strip()
        if content.endswith('```'):
            content = content[:-3].strip()
        if content.endswith(','): content = content[:-1]
        if not content.endswith(']'): content += ']'
        if not content.startswith('['): content = '[' + content
        astronauts = json.loads(content)
        if not isinstance(astronauts, list):
            raise HTTPException(status_code=500, detail="Response is not a JSON array")
        for astronaut in astronauts:
            if not all(key in astronaut for key in ['name', 'nationality', 'space_agency', 'notable_missions', 'current_status']):
                raise HTTPException(status_code=500, detail="Invalid astronaut format")
            if not isinstance(astronaut['notable_missions'], list):
                raise HTTPException(status_code=500, detail="Invalid notable_missions format")
            astronaut['name'] = astronaut['name'].strip()
            astronaut['current_status'] = astronaut['current_status'].lower()
            astronaut['image_url'] = fetch_image_with_llama3_or_pixabay(f"{astronaut['name']} astronaut")
        logger.info(f"Successfully searched astronauts for query: {query.query}")
        return astronauts
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON from Groq: {content}")
        raise HTTPException(status_code=500, detail="Invalid JSON from Groq")
    except Exception as e:
        logger.error(f"Error searching astronauts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class AstronautName(BaseModel):
    name: str

@app.post("/api/astronaut-details")
async def get_astronaut_details(data: AstronautName):
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API Key is not set")
        if not data.name:
            raise HTTPException(status_code=400, detail="Astronaut name is required")
        payload = get_astronaut_details_payload(data.name)
        content = call_groq_api(payload)
        if not content or content.strip() == "":
            raise HTTPException(status_code=500, detail="Empty response from Groq")
        content = content.strip()
        if content.startswith('```json'):
            content = content[7:].strip()
        if content.endswith('```'):
            content = content[:-3].strip()
        details = json.loads(content)
        if not isinstance(details, dict):
            raise HTTPException(status_code=500, detail="Response is not a JSON object")
        required_fields = ['biography', 'firstMission', 'family', 'additionalInfo']
        for field in required_fields:
            if field not in details or not isinstance(details[field], str):
                raise HTTPException(status_code=500, detail=f"Missing or invalid field: {field}")
        logger.info(f"Successfully fetched details for astronaut: {data.name}")
        return details
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON from Groq: {content}")
        raise HTTPException(status_code=500, detail="Invalid JSON from Groq")
    except Exception as e:
        logger.error(f"Error fetching astronaut details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/missions")
async def get_missions():
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API Key is not set")
        if not PIXABAY_API_KEY:
            raise HTTPException(status_code=500, detail="Pixabay API Key is not set")
        payload = get_missions_payload()
        content = call_groq_api(payload)
        if not content or content.strip() == "":
            raise HTTPException(status_code=500, detail="Empty response from Groq")
        content = content.strip()
        if content.startswith('```json'):
            content = content[7:].strip()
        if content.endswith('```'):
            content = content[:-3].strip()
        if content.startswith('[') and not content.endswith(']'): content += ']'
        missions = json.loads(content)
        if not isinstance(missions, list):
            raise HTTPException(status_code=500, detail="Response is not a JSON array")
        for mission in missions:
            if not all(key in mission for key in ['mission_name', 'organization', 'country', 'type', 'start_date', 'end_date', 'description']):
                raise HTTPException(status_code=500, detail="Invalid mission format")
            mission['image_url'] = fetch_image_with_llama3_or_pixabay('space mission ' + mission['mission_name'])
        logger.info("Successfully fetched missions")
        return missions
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON from Groq: {content}")
        raise HTTPException(status_code=500, detail="Invalid JSON from Groq")
    except Exception as e:
        logger.error(f"Error fetching missions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quiz")
async def get_quiz_questions():
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API Key is not set")
        payload = get_quiz_payload()
        content = call_groq_api(payload)
        if not content or content.strip() == "":
            raise HTTPException(status_code=500, detail="Empty response from Groq")
        content = content.strip()
        if content.startswith('```json'):
            content = content[7:].strip()
        if content.endswith('```'):
            content = content[:-3].strip()
        questions = json.loads(content)
        if not isinstance(questions, list):
            raise HTTPException(status_code=500, detail="Response is not a JSON array")
        for question in questions:
            if not all(key in question for key in ['question', 'options', 'correctAnswer', 'explanation']):
                raise HTTPException(status_code=500, detail="Invalid question format")
            if not isinstance(question['options'], list) or len(question['options']) != 4:
                raise HTTPException(status_code=500, detail="Invalid options format")
        logger.info("Successfully fetched quiz questions")
        return questions
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON from Groq: {content}")
        raise HTTPException(status_code=500, detail="Invalid JSON from Groq")
    except Exception as e:
        logger.error(f"Error fetching quiz questions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/memory-cards")
async def get_memory_cards():
    try:
        space_items = [
            {"name": "Mars", "image_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn9GcRgXBghYx2s8GqEqwY1qVFmZl05KXEnKb5IqA&s"},
            {"name": "Milky Way", "image_url": "https://media.istockphoto.com/id/480798670/photo/spiral-galaxy-illustration-of-milky-way.jpg?s=612x612&w=0&k=20&c=MLE2w9wM03YDWsk20Sd1-Pz4xdHDMc-8_v4Ar1JhiaQ="},
            {"name": "Space Station", "image_url": "https://media.istockphoto.com/id/157506243/photo/international-space-station-iss.jpg?s=612x612&w=0&k=20&c=lVOPR-7Wrsvyu0QW21AJBMZZl3DqozEC2WC2ps7-NOk="},
            {"name": "Saturn", "image_url": "https://cdn.esahubble.org/archives/images/screen/heic2312a.jpg"},
            {"name": "Earth", "image_url": "https://images.pexels.com/photos/87651/earth-blue-planet-globe-planet-87651.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500"},
            {"name": "Venus", "image_url": "https://solarsystem.nasa.gov/system/feature_items/images/27_venus_jg.png"},
            {"name": "Neptune", "image_url": "https://media.istockphoto.com/id/533260861/photo/abstract-neptune-planet-generated-texture-background.jpg?s=612x612&w=0&k=20&c=Bt3Q8miiVcUhG74AJ-WL74IPMlaf_7HK_AVLFdZEq1U="},
            {"name": "Uranus", "image_url": "https://c02.purpledshub.com/uploads/sites/48/2019/10/Hubble_Uranus-4b72360.jpg?webp=1&w=1200"}
        ]
        shuffled_items = space_items.copy()
        random.shuffle(shuffled_items)
        logger.info("Successfully fetched memory cards")
        return shuffled_items
    except Exception as e:
        logger.error(f"Error fetching memory cards: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nasa/stats")
async def get_nasa_stats():
    try:
        if not NASA_API_KEY:
            raise HTTPException(status_code=500, detail="NASA API Key is not set")
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API Key is not set")
        today = datetime.now()
        start_date = (today - timedelta(days=1)).strftime('%Y-%m-%d')
        end_date = today.strftime('%Y-%m-%d')
        neo_data = get_neo_feed(start_date, end_date)
        asteroid_count = neo_data.get('element_count', 0)
        asteroids = neo_data.get('near_earth_objects', {}).get(start_date, [])
        payload = get_spaceflight_data_payload()
        content = call_groq_api(payload)
        if not content or content.strip() == "":
            raise HTTPException(status_code=500, detail="Empty response from Groq")
        content = content.strip()
        if content.startswith('```json'):
            content = content[7:].strip()
        if content.endswith('```'):
            content = content[:-3].strip()
        spaceflight_data = json.loads(content)
        if not isinstance(spaceflight_data, dict) or 'launches_by_year' not in spaceflight_data or 'missions_by_type' not in spaceflight_data:
            raise HTTPException(status_code=500, detail="Invalid spaceflight data format")
        stats = {
            'asteroid_data': {'count': asteroid_count, 'details': asteroids},
            'launches_by_year': spaceflight_data['launches_by_year'],
            'missions_by_type': spaceflight_data['missions_by_type']
        }
        logger.info("Successfully fetched NASA stats")
        return stats
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON from Groq: {content}")
        raise HTTPException(status_code=500, detail="Invalid JSON from Groq")
    except Exception as e:
        logger.error(f"Error fetching NASA stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/articles")
async def get_articles(date: Optional[str] = None, query: Optional[str] = None):
    try:
        if not date and not query:
            raise HTTPException(status_code=400, detail="Date or query parameter required")
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API Key is not set")
        payload = get_articles_payload(date, query)
        articles_text = call_groq_api(payload)
        if not articles_text or articles_text.strip() == "":
            raise HTTPException(status_code=500, detail="Empty response from Groq")
        articles_text = articles_text.strip()
        if articles_text.startswith('```json'):
            articles_text = articles_text[7:].strip()
        if articles_text.endswith('```'):
            articles_text = articles_text[:-3].strip()
        articles = json.loads(articles_text)
        if not isinstance(articles, list):
            raise HTTPException(status_code=500, detail="Response is not a JSON array")
        for article in articles:
            if not all(key in article for key in ['title', 'summary', 'link', 'date']):
                raise HTTPException(status_code=500, detail="Invalid article format")
            article['imageUrl'] = fetch_image_with_llama3_or_pixabay(article['title'])
        logger.info("Successfully fetched articles")
        return articles
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON from Groq: {articles_text}")
        raise HTTPException(status_code=500, detail="Invalid JSON from Groq")
    except Exception as e:
        logger.error(f"Error fetching articles: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class ChatMessage(BaseModel):
    message: str

@app.post("/api/chat")
async def chat(data: ChatMessage):
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API Key is not set")
        chat_context = [
            {"role": "system", "content": "You are a helpful space and astronomy assistant. Provide concise, accurate information about space, planets, stars, NASA missions, and astronomical phenomena. When appropriate, suggest stargazing tips or interesting facts about the cosmos."},
            {"role": "user", "content": data.message}
        ]
        payload = {
            "model": "llama3-8b-8192",
            "messages": chat_context,
            "temperature": 0.7,
            "max_tokens": 800,
        }
        content = call_groq_api(payload)
        logger.info("Successfully processed chat request")
        return {"response": content}
    except Exception as e:
        logger.error(f"Error in chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)