from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import random
import json
import requests
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pydantic import BaseModel

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

# Cache mechanism
CACHE = {}
CACHE_EXPIRY = {}
CACHE_DURATION = 3600  # 1 hour in seconds

# Fallback data
FALLBACK_ASTRONAUTS = [
    {
        "name": "Neil Armstrong",
        "nationality": "American",
        "space_agency": "NASA",
        "notable_missions": ["Apollo 11", "Gemini 8"],
        "current_status": "deceased",
        "image_url": "https://picsum.photos/seed/armstrong/400/225"
    },
    {
        "name": "Buzz Aldrin",
        "nationality": "American",
        "space_agency": "NASA",
        "notable_missions": ["Apollo 11", "Gemini 12"],
        "current_status": "retired",
        "image_url": "https://picsum.photos/seed/aldrin/400/225"
    },
    {
        "name": "Sunita Williams",
        "nationality": "American",
        "space_agency": "NASA",
        "notable_missions": ["Expedition 14/15", "Expedition 32/33"],
        "current_status": "active",
        "image_url": "https://picsum.photos/seed/williams/400/225"
    }
]

FALLBACK_MISSIONS = [
    {
        "mission_name": "Mars Sample Return",
        "organization": "NASA/ESA",
        "country": "USA/Europe",
        "type": "future",
        "start_date": "2026-07-15",
        "end_date": None,
        "description": "Mission to collect and return samples from Mars",
        "image_url": "https://picsum.photos/seed/marssample/400/225"
    },
    {
        "mission_name": "Artemis Program",
        "organization": "NASA",
        "country": "USA",
        "type": "current",
        "start_date": "2022-11-16",
        "end_date": None,
        "description": "Program to return humans to the Moon",
        "image_url": "https://picsum.photos/seed/artemis/400/225"
    }
]

# Helper functions
def get_cache(key):
    now = time.time()
    if key in CACHE and key in CACHE_EXPIRY and now < CACHE_EXPIRY[key]:
        return CACHE[key]
    return None

def set_cache(key, value):
    CACHE[key] = value
    CACHE_EXPIRY[key] = time.time() + CACHE_DURATION

def make_groq_request(payload, max_retries=3, fallback_data=None):
    """Make a request to Groq API with retries and proper error handling"""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail='Groq API Key is not set.')
    
    headers = {
        'Authorization': f'Bearer {GROQ_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    # Update model to a reliably available one
    # Using 'llama3-70b-8192' as the primary model and 'llama3-8b-8192' as a fallback
    available_models = ['llama3-70b-8192', 'llama3-8b-8192']
    
    # Try each model until success or all fail
    for model in available_models:
        payload['model'] = model
        
        for attempt in range(max_retries):
            try:
                print(f"Attempting Groq request with model {model}, attempt {attempt+1}")
                
                response = requests.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    json=payload,
                    headers=headers,
                    timeout=30  # Add timeout to prevent hanging requests
                )
                
                # Log response status and headers for debugging
                print(f"Groq response status: {response.status_code}")
                print(f"Groq response headers: {response.headers}")
                
                if response.status_code == 200:
                    result = response.json()
                    return result['choices'][0]['message']['content']
                
                # Log error details
                print(f"Groq error on attempt {attempt+1}: Status {response.status_code}")
                print(f"Error response: {response.text[:500]}")
                
                # Don't retry for client errors except rate limits
                if response.status_code == 400:
                    print("Bad request error. Payload might be invalid.")
                    print(f"Payload: {json.dumps(payload)[:1000]}")
                    break
                
                if response.status_code == 401:
                    print("Authentication error with Groq API key")
                    raise HTTPException(status_code=500, detail="Invalid Groq API credentials")
                
                # For rate limits, wait longer
                if response.status_code == 429:
                    retry_after = int(response.headers.get('Retry-After', attempt + 1))
                    print(f"Rate limited. Waiting {retry_after} seconds.")
                    time.sleep(retry_after)
                else:
                    # Exponential backoff for other errors
                    wait_time = 2 ** attempt
                    print(f"Waiting {wait_time} seconds before retry")
                    time.sleep(wait_time)
                
            except requests.RequestException as e:
                print(f"Request exception on attempt {attempt+1}: {str(e)}")
                time.sleep(2 ** attempt)
    
    # If we get here, all attempts with all models failed
    print("All Groq API requests failed. Using fallback data.")
    if fallback_data:
        return json.dumps(fallback_data)
    
    raise HTTPException(
        status_code=503, 
        detail="Service currently unavailable. Please try again later."
    )

def fetch_pixabay_image(query: str) -> str:
    """Fetch image URL from Pixabay with error handling"""
    if not PIXABAY_API_KEY:
        return "https://picsum.photos/seed/picsum/400/225"
    
    cache_key = f"pixabay_{query}"
    cached_url = get_cache(cache_key)
    if cached_url:
        return cached_url
    
    pixabay_url = f"https://pixabay.com/api/?key={PIXABAY_API_KEY}&q={query.replace(' ', '+')}&image_type=photo&category=science&orientation=horizontal&safesearch=true"
    try:
        response = requests.get(pixabay_url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'hits' in data and data['hits']:
                url = data['hits'][0]['webformatURL']
                set_cache(cache_key, url)
                return url
        
        # Fallback to alternative source
        url = f"https://picsum.photos/seed/{query.replace(' ', '')}/400/225"
        set_cache(cache_key, url)
        return url
    except Exception as e:
        print(f"Pixabay API error: {str(e)}")
        return f"https://picsum.photos/seed/{query.replace(' ', '')}/400/225"

# API Endpoints
@app.get("/api/health")
async def health_check():
    """Health check endpoint to verify the API is running"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/api/nasa/apod")
async def get_nasa_apod():
    """Get NASA Astronomy Picture of the Day"""
    cache_key = "nasa_apod"
    cached_data = get_cache(cache_key)
    if cached_data:
        return cached_data
    
    try:
        if not NASA_API_KEY:
            raise HTTPException(status_code=500, detail='NASA API Key is not set.')
        
        url = f'https://api.nasa.gov/planetary/apod?api_key={NASA_API_KEY}'
        response = requests.get(url, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            set_cache(cache_key, data)
            return data
        
        # Fallback data if NASA API fails
        fallback_data = {
            "title": "Cosmic View",
            "explanation": "This is a fallback image while the NASA API is unavailable.",
            "url": "https://picsum.photos/seed/cosmos/800/600",
            "media_type": "image",
            "date": datetime.now().strftime("%Y-%m-%d")
        }
        return fallback_data
    except Exception as e:
        print(f"NASA APOD API error: {str(e)}")
        fallback_data = {
            "title": "Cosmic View",
            "explanation": "This is a fallback image while the NASA API is unavailable.",
            "url": "https://picsum.photos/seed/cosmos/800/600",
            "media_type": "image",
            "date": datetime.now().strftime("%Y-%m-%d")
        }
        return fallback_data

@app.get("/api/space-weather")
async def get_space_weather(request: Request):
    """Get space weather data based on coordinates"""
    try:
        lat = request.headers.get('X-Latitude')
        lon = request.headers.get('X-Longitude')

        if not lon or not lat:
            raise HTTPException(status_code=400, detail='Longitude and Latitude are required')
        
        cache_key = f"weather_{lat}_{lon}"
        cached_data = get_cache(cache_key)
        if cached_data:
            return cached_data

        if not WEATHER_BASE_URL:
            raise HTTPException(status_code=500, detail='Weather Base URL is not set.')

        url = f"{WEATHER_BASE_URL}?lon={lon}&lat={lat}&ac=0&unit=metric&output=json&tzshift=0"
        print(f"Weather URL: {url}")

        response = requests.get(url, timeout=15)
        if response.status_code == 200:
            data = response.json()
            set_cache(cache_key, data)
            return data
        
        # Weather service unavailable
        raise HTTPException(
            status_code=503,
            detail="Weather service currently unavailable. Please try again later."
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Weather API error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/astronauts")
async def get_astronauts(background_tasks: BackgroundTasks):
    """Get list of astronauts"""
    cache_key = "astronauts_list"
    cached_data = get_cache(cache_key)
    if cached_data:
        return cached_data

    try:
        payload = {
            'model': 'llama3-8b-8192',
            'messages': [{
                'role': 'user',
                'content': '''Generate a detailed list of 20 astronauts with the following information:
                - name (string)
                - nationality (string)
                - space_agency (string, e.g., ISRO, NASA, ESA, Roscosmos, etc.)
                - notable_missions (array of strings)
                - current_status (string, active/retired/deceased)
                
                Format as a valid JSON array. Ensure the response is only the JSON array with no additional text or explanations outside the array.
                '''
            }],
            'max_tokens': 2048,
            'temperature': 0.3
        }

        try:
            content = make_groq_request(payload, fallback_data=FALLBACK_ASTRONAUTS)
            
            # Clean up the response to ensure it's valid JSON
            content = content.strip()
            
            # Handle potential markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].strip()
            
            # Add missing brackets if needed
            if not content.startswith('['):
                content = '[' + content
            if not content.endswith(']'):
                content += ']'
            
            astronauts = json.loads(content)
            
            # Validate structure
            for astronaut in astronauts:
                if not isinstance(astronaut, dict) or \
                   'name' not in astronaut or \
                   'nationality' not in astronaut or \
                   'space_agency' not in astronaut or \
                   'notable_missions' not in astronaut or \
                   'current_status' not in astronaut:
                    raise ValueError(f'Invalid astronaut format: {astronaut}')

                if not isinstance(astronaut['notable_missions'], list):
                    astronaut['notable_missions'] = [astronaut['notable_missions']]

                astronaut['name'] = astronaut['name'].strip()
                astronaut['current_status'] = astronaut['current_status'].lower()
                
                # Fetch images in the background to speed up response
                astronaut['image_url'] = f"https://picsum.photos/seed/{astronaut['name'].replace(' ', '')}/400/225"
                background_tasks.add_task(
                    update_astronaut_image,
                    astronauts,
                    astronaut
                )
            
            set_cache(cache_key, astronauts)
            return astronauts
            
        except Exception as e:
            print(f"Error parsing astronauts: {str(e)}")
            return FALLBACK_ASTRONAUTS
            
    except Exception as e:
        print(f"Astronauts API error: {str(e)}")
        return FALLBACK_ASTRONAUTS

def update_astronaut_image(astronauts_list, astronaut):
    """Update astronaut image URL in the background"""
    try:
        image_url = fetch_pixabay_image(f"{astronaut['name']} astronaut")
        for a in astronauts_list:
            if a['name'] == astronaut['name']:
                a['image_url'] = image_url
                break
    except Exception as e:
        print(f"Error updating astronaut image: {str(e)}")

class SearchQuery(BaseModel):
    query: str

@app.post("/api/search-astronauts")
async def search_astronauts(query: SearchQuery, background_tasks: BackgroundTasks):
    """Search for astronauts matching a query"""
    if not query.query:
        raise HTTPException(status_code=400, detail='Search query is required')
    
    cache_key = f"search_astronauts_{query.query}"
    cached_data = get_cache(cache_key)
    if cached_data:
        return cached_data

    try:
        payload = {
            'model': 'llama3-8b-8192',
            'messages': [{
                'role': 'user',
                'content': f'''Search for astronauts matching the query "{query.query}" (could be a name, nationality, or space agency). Provide a list of up to 10 astronauts with the following information:
                - name (string)
                - nationality (string)
                - space_agency (string, e.g., ISRO, NASA, ESA, Roscosmos, etc.)
                - notable_missions (array of strings)
                - current_status (string, active/retired/deceased)
                
                Format as a valid JSON array. Ensure the response is only the JSON array with no additional text or explanations outside the array.
                '''
            }],
            'max_tokens': 2048,
            'temperature': 0.3
        }

        try:
            # Filter from cached data if available
            all_astronauts = get_cache("astronauts_list")
            if all_astronauts:
                query_lower = query.query.lower()
                filtered = [
                    a for a in all_astronauts 
                    if query_lower in a['name'].lower() or 
                       query_lower in a['nationality'].lower() or 
                       query_lower in a['space_agency'].lower()
                ]
                if filtered:
                    return filtered

            # Otherwise query Groq
            content = make_groq_request(payload)
            
            # Clean up JSON
            content = content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].strip()
            
            if not content.startswith('['):
                content = '[' + content
            if not content.endswith(']'):
                content += ']'
            
            astronauts = json.loads(content)
            
            # Validate and enhance
            for astronaut in astronauts:
                if not isinstance(astronaut, dict) or \
                   'name' not in astronaut or \
                   'nationality' not in astronaut or \
                   'space_agency' not in astronaut or \
                   'notable_missions' not in astronaut or \
                   'current_status' not in astronaut:
                    raise ValueError(f'Invalid astronaut format: {astronaut}')

                if not isinstance(astronaut['notable_missions'], list):
                    astronaut['notable_missions'] = [astronaut['notable_missions']]

                astronaut['name'] = astronaut['name'].strip()
                astronaut['current_status'] = astronaut['current_status'].lower()
                astronaut['image_url'] = f"https://picsum.photos/seed/{astronaut['name'].replace(' ', '')}/400/225"
                
                background_tasks.add_task(
                    lambda a=astronaut: a.update({'image_url': fetch_pixabay_image(f"{a['name']} astronaut")})
                )
            
            set_cache(cache_key, astronauts)
            return astronauts
        except Exception as e:
            print(f"Error parsing search results: {str(e)}")
            # Filter fallback data based on query
            query_lower = query.query.lower()
            filtered = [
                a for a in FALLBACK_ASTRONAUTS 
                if query_lower in a['name'].lower() or 
                   query_lower in a['nationality'].lower() or 
                   query_lower in a['space_agency'].lower()
            ]
            if filtered:
                return filtered
            return FALLBACK_ASTRONAUTS
            
    except Exception as e:
        print(f"Search astronauts API error: {str(e)}")
        return FALLBACK_ASTRONAUTS

class AstronautName(BaseModel):
    name: str

@app.post("/api/astronaut-details")
async def get_astronaut_details(data: AstronautName):
    """Get detailed information about a specific astronaut"""
    if not data.name:
        raise HTTPException(status_code=400, detail='Astronaut name is required')
    
    cache_key = f"astronaut_details_{data.name}"
    cached_data = get_cache(cache_key)
    if cached_data:
        return cached_data

    try:
        payload = {
            'model': 'llama3-8b-8192',
            'messages': [{
                'role': 'user',
                'content': f'''Fetch detailed information about the astronaut {data.name} from Wikipedia. Provide the following details in a JSON object:
                - biography (string, a brief biography)
                - firstMission (string, details about their first space mission)
                - family (string, information about their family)
                - additionalInfo (string, any other notable information)
                
                Format as a valid JSON object. Ensure the response is only the JSON object with no additional text or explanations outside the object.
                '''
            }],
            'max_tokens': 2048,
            'temperature': 0.3
        }

        try:
            content = make_groq_request(payload)
            
            # Clean up JSON content
            content = content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].strip()
            
            details = json.loads(content)
            
            # Validate response structure
            required_fields = ['biography', 'firstMission', 'family', 'additionalInfo']
            for field in required_fields:
                if field not in details or not isinstance(details[field], str):
                    details[field] = f"Information about {field} for {data.name} is not available."
            
            set_cache(cache_key, details)
            return details
            
        except Exception as e:
            print(f"Error parsing astronaut details: {str(e)}")
            # Return fallback data
            return {
                "biography": f"Detailed information about {data.name} is temporarily unavailable.",
                "firstMission": "Mission information unavailable at this time.",
                "family": "Family information unavailable at this time.",
                "additionalInfo": "Our system is currently experiencing issues retrieving additional information."
            }
            
    except Exception as e:
        print(f"Astronaut details API error: {str(e)}")
        return {
            "biography": f"Detailed information about {data.name} is temporarily unavailable.",
            "firstMission": "Mission information unavailable at this time.",
            "family": "Family information unavailable at this time.",
            "additionalInfo": "Our system is currently experiencing issues retrieving additional information."
        }

@app.get("/api/missions")
async def get_missions(background_tasks: BackgroundTasks):
    """Get list of space missions"""
    cache_key = "missions_list"
    cached_data = get_cache(cache_key)
    if cached_data:
        return cached_data

    try:
        payload = {
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

                Format as a valid JSON array. Ensure the response is only the JSON array with no additional text or explanations outside the array.
                '''
            }],
            'max_tokens': 2048,
            'temperature': 0.3
        }

        try:
            content = make_groq_request(payload, fallback_data=FALLBACK_MISSIONS)
            
            # Clean up JSON
            content = content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].strip()
            
            if not content.startswith('['):
                content = '[' + content
            if not content.endswith(']'):
                content += ']'
            
            missions = json.loads(content)
            
            # Validate and enhance
            for mission in missions:
                if not isinstance(mission, dict) or \
                   'mission_name' not in mission or \
                   'organization' not in mission or \
                   'country' not in mission or \
                   'type' not in mission or \
                   'start_date' not in mission or \
                   'end_date' not in mission or \
                   'description' not in mission:
                    raise ValueError(f'Invalid mission format: {mission}')
                
                # Add placeholder image initially for fast response
                mission['image_url'] = f"https://picsum.photos/seed/{mission['mission_name'].replace(' ', '')}/400/225"
                
                # Schedule background task to update image
                background_tasks.add_task(
                    update_mission_image,
                    missions,
                    mission
                )
            
            set_cache(cache_key, missions)
            return missions
            
        except Exception as e:
            print(f"Error parsing missions: {str(e)}")
            return FALLBACK_MISSIONS
            
    except Exception as e:
        print(f"Missions API error: {str(e)}")
        return FALLBACK_MISSIONS

def update_mission_image(missions_list, mission):
    """Update mission image URL in the background"""
    try:
        image_url = fetch_pixabay_image('space mission ' + mission['mission_name'])
        for m in missions_list:
            if m['mission_name'] == mission['mission_name']:
                m['image_url'] = image_url
                break
    except Exception as e:
        print(f"Error updating mission image: {str(e)}")

@app.get("/api/quiz")
async def get_quiz_questions():
    """Get space-related quiz questions"""
    cache_key = "quiz_questions"
    cached_data = get_cache(cache_key)
    if cached_data:
        return cached_data

    try:
        payload = {
            'model': 'llama3-8b-8192',
            'messages': [{
                'role': 'user',
                'content': '''Generate 10 space-related quiz questions with:
                - question (string, e.g., "What is the closest planet to the Sun?")
                - options (array of 4 strings, e.g., ["Mercury", "Venus", "Earth", "Mars"])
                - correctAnswer (string, e.g., "Mercury")
                - explanation (string, e.g., "Mercury is the closest planet to the Sun, orbiting at an average distance of 58 million kilometers.")
                Cover topics like astronomy, space exploration, and space technology.
                Return the result as a valid JSON array. Ensure the response is only the JSON array with no additional text or explanations outside the array.
                '''
            }],
            'max_tokens': 2048,
            'temperature': 0.3
        }
        
        try:
            content = make_groq_request(payload)
            
            # Clean up JSON
            content = content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].strip()
            
            if not content.startswith('['):
                content = '[' + content
            if not content.endswith(']'):
                content += ']'
            
            questions = json.loads(content)
            
            # Validate structure
            for question in questions:
                if not isinstance(question, dict) or \
                   'question' not in question or \
                   'options' not in question or \
                   'correctAnswer' not in question or \
                   'explanation' not in question:
                    raise ValueError(f'Invalid question format: {question}')
                    
                if not isinstance(question['options'], list) or len(question['options']) != 4:
                    question['options'] = ["Option A", "Option B", "Option C", "Option D"]
                    question['correctAnswer'] = "Option A"
            
            set_cache(cache_key, questions)
            return questions
            
        except Exception as e:
            print(f"Error parsing quiz questions: {str(e)}")
            # Return fallback quiz questions
            return [
                {
                    "question": "What is the closest planet to the Sun?",
                    "options": ["Mercury", "Venus", "Earth", "Mars"],
                    "correctAnswer": "Mercury",
                    "explanation": "Mercury is the closest planet to the Sun, orbiting at an average distance of 58 million kilometers."
                },
                {
                    "question": "Which spacecraft carried the first humans to the Moon?",
                    "options": ["Apollo 11", "Gemini 4", "Soyuz 1", "Vostok 1"],
                    "correctAnswer": "Apollo 11",
                    "explanation": "Apollo 11 was the spacecraft that carried Neil Armstrong and Buzz Aldrin to the Moon's surface on July 20, 1969."
                }
            ]
            
    except Exception as e:
        print(f"Quiz API error: {str(e)}")
        return [
            {
                "question": "What is the closest planet to the Sun?",
                "options": ["Mercury", "Venus", "Earth", "Mars"],
                "correctAnswer": "Mercury",
                "explanation": "Mercury is the closest planet to the Sun, orbiting at an average distance of 58 million kilometers."
            },
            {
                "question": "Which spacecraft carried the first humans to the Moon?",
                "options": ["Apollo 11", "Gemini 4", "Soyuz 1", "Vostok 1"],
                "correctAnswer": "Apollo 11",
                "explanation": "Apollo 11 was the spacecraft that carried Neil Armstrong and Buzz Aldrin to the Moon's surface on July 20, 1969."
            }
        ]

@app.get("/api/memory-cards")
async def get_memory_cards():
    """Get space-themed memory cards"""
    space_items = [
        {"name": "Mars", "image_url": "https://picsum.photos/seed/mars/400/320"},
        {"name": "Milky Way", "image_url": "https://picsum.photos/seed/milkyway/400/320"},
        {"name": "Space Station", "image_url": "https://picsum.photos/seed/spacestation/400/320"},
        {"name": "Saturn", "image_url": "https://picsum.photos/seed/saturn/400/320"},
        {"name": "Earth", "image_url": "https://picsum.photos/seed/earth/400/320"},
        {"name": "Venus", "image_url": "https://picsum.photos/seed/venus/400/320"},
        {"name": "Neptune", "image_url": "https://picsum.photos/seed/neptune/400/320"},
        {"name": "Uranus", "image_url": "https://picsum.photos/seed/uranus/400/320"}
    ]
    
    shuffled_items = space_items.copy()
    random.shuffle(shuffled_items)
    
    return shuffled_items

@app.get("/api/nasa/stats")
async def get_nasa_stats():
    """Get NASA stats including near-Earth objects and mission data"""
    cache_key = "nasa_stats"
    cached_data = get_cache(cache_key)
    if cached_data:
        return cached_data

    try:
        if not NASA_API_KEY:
            raise HTTPException(status_code=500, detail='NASA API Key is not set.')

        # Calculate date range for NEO feed (last 7 days)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        formatted_end = end_date.strftime('%Y-%m-%d')
        formatted_start = start_date.strftime('%Y-%m-%d')

        # Fetch Near Earth Objects data
        neo_params = {
            'start_date': formatted_start,
            'end_date': formatted_end,
            'api_key': NASA_API_KEY
        }
        neo_headers = {
            'User-Agent': 'SpaceApp/1.0 (https://example.com/space-app)'
        }

        try:
            neo_response = requests.get(
                NEO_FEED_URL,
                params=neo_params,
                headers=neo_headers,
                timeout=15
            )
            neo_response.raise_for_status()
            neo_data = neo_response.json()
        except Exception as e:
            print(f"NASA NEO API error: {str(e)}")
            neo_data = {'element_count': 0, 'near_earth_objects': {}}

        asteroid_count = neo_data.get('element_count', 0)
        asteroids = []
        for date in neo_data.get('near_earth_objects', {}):
            asteroids.extend(neo_data['near_earth_objects'][date][:3])  # Get first 3

        # Generate synthetic spaceflight data
        groq_payload = {
            'model': 'llama3-8b-8192',
            'messages': [{
                'role': 'user',
                'content': '''Generate realistic spaceflight statistics for 2020-2025 including:
                - launches_by_year: {year: count}
                - missions_by_type: {type: count}
                Format as JSON with only these keys.'''
            }],
            'max_tokens': 512,
            'temperature': 0.3
        }

        fallback_stats = {
            "launches_by_year": {"2024": 15, "2025": 18},
            "missions_by_type": {"Lunar": 12, "Mars": 8, "Earth Observation": 25}
        }

        try:
            content = make_groq_request(groq_payload, fallback_data=fallback_stats)
            space_data = json.loads(content)
            
            # Validate structure
            if not all(key in space_data for key in ['launches_by_year', 'missions_by_type']):
                space_data = fallback_stats
        except Exception as e:
            print(f"Groq stats error: {str(e)}")
            space_data = fallback_stats

        stats = {
            'asteroid_data': {
                'count': asteroid_count,
                'sample_objects': asteroids[:3]  # Return first 3
            },
            'launch_stats': space_data['launches_by_year'],
            'mission_stats': space_data['missions_by_type']
        }

        set_cache(cache_key, stats)
        return stats

    except Exception as e:
        print(f"NASA stats error: {str(e)}")
        return {
            'asteroid_data': {'count': 0, 'sample_objects': []},
            'launch_stats': {"2024": 15, "2025": 18},
            'mission_stats': {"Lunar": 12, "Mars": 8, "Earth Observation": 25}
        }

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)