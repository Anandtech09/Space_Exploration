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

FALLBACK_ARTICLES = [
    {
        "title": "NASA's James Webb Telescope Discovers New Exoplanet",
        "summary": "The James Webb Space Telescope has identified a new Earth-like exoplanet in the habitable zone.",
        "link": "#",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "imageUrl": "https://picsum.photos/seed/exoplanet/800/500"
    },
    {
        "title": "SpaceX Successfully Tests Starship Orbital Flight",
        "summary": "SpaceX conducted another successful test of its Starship spacecraft.",
        "link": "#",
        "date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
        "imageUrl": "https://picsum.photos/seed/starship/800/500"
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
    try:
        if not NASA_API_KEY:
            raise HTTPException(status_code=500, detail='NASA API Key is not set.')

        today = datetime(2025, 3, 11)
        start_date = (today - timedelta(days=1)).strftime('%Y-%m-%d')
        end_date = today.strftime('%Y-%m-%d')

        neo_params = {
            'start_date': start_date,
            'end_date': end_date,
            'api_key': NASA_API_KEY
        }
        neo_headers = {
            'User-Agent': 'MyFastAPIApp/1.0 (your.email@example.com)'
        }
        neo_response = requests.get(
            NEO_FEED_URL,
            params=neo_params,
            headers=neo_headers
        )
        neo_response.raise_for_status()
        neo_data = neo_response.json()

        asteroid_count = neo_data.get('element_count', 0)
        asteroids = neo_data.get('near_earth_objects', {}).get(start_date, [])

        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail='Groq API Key is not set.')

        groq_headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': 'mixtral-8x7b-32768',
            'messages': [{
                'role': 'user',
                'content': '''Generate synthetic spaceflight news data for the years 2020 to 2025. Include:
                - launches_by_year: a JSON object with years as keys (e.g., "2020", "2021") and the number of launches as values.
                - missions_by_type: a JSON object with mission types as keys (e.g., "Lunar", "Mars", "Earth Observation", "Deep Space") and the number of missions as values.
                Ensure the data is realistic for spaceflight activities, with total launches between 50-100 across the period and mission types distributed proportionally.
                Return the result as a valid JSON object with only these two fields, no additional text or explanations.
                Example:
                {
                    "launches_by_year": {"2020": 10, "2021": 12, "2022": 15, "2023": 18, "2024": 20, "2025": 15},
                    "missions_by_type": {"Lunar": 20, "Mars": 15, "Earth Observation": 30, "Deep Space": 15}
                }
                '''
            }],
            'max_tokens': 512,
            'temperature': 0.3
        }

        groq_response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            json=payload,
            headers=groq_headers
        )
        groq_response.raise_for_status()
        
        groq_data = groq_response.json()
        content = groq_data['choices'][0]['message']['content']
        print("Groq content:", content)

        if not content or content.strip() == "":
            raise HTTPException(status_code=500, detail='Empty response from Groq')

        try:
            spaceflight_data = json.loads(content)
            if not isinstance(spaceflight_data, dict) or \
               'launches_by_year' not in spaceflight_data or \
               'missions_by_type' not in spaceflight_data:
                raise HTTPException(status_code=500, detail='Invalid spaceflight data format', extra={'raw_content': content})
        except json.JSONDecodeError as e:
            print("Invalid JSON content:", content)
            raise HTTPException(status_code=500, detail='Invalid JSON from Groq', extra={'raw_content': content})

        stats = {
            'asteroid_data': {
                'count': asteroid_count,
                'details': asteroids
            },
            'launches_by_year': spaceflight_data['launches_by_year'],
            'missions_by_type': spaceflight_data['missions_by_type']
        }

        return stats
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/articles")
async def get_articles(
    background_tasks: BackgroundTasks,
    date: Optional[str] = None, 
    query: Optional[str] = None
):
    """Get space-related articles"""
    cache_key = f"articles_{date}_{query}"
    cached_data = get_cache(cache_key)
    if cached_data:
        return cached_data

    try:
        # Validate at least one parameter exists
        if not date and not query:
            date = datetime.now().strftime("%Y-%m-%d")

        # Build Groq request payload
        payload = {
            'model': 'llama3-8b-8192',
            'messages': [{
                'role': 'user',
                'content': f'''Generate 6 space-related articles {"for " + date if date else "about " + query}.
                Include:
                - title (string)
                - summary (string, 1-2 sentences)
                - link (string, placeholder "#")
                - date (string, YYYY-MM-DD)
                
                Format as JSON array. Response should ONLY contain the array.'''
            }],
            'max_tokens': 1024,
            'temperature': 0.7
        }

        content = make_groq_request(payload, fallback_data=FALLBACK_ARTICLES)
        
        # Clean and validate JSON response
        content = content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
        
        if not content.startswith('['):
            content = '[' + content
        if not content.endswith(']'):
            content += ']'

        articles = json.loads(content)

        # Validate article structure
        valid_articles = []
        for article in articles:
            if not isinstance(article, dict):
                continue
                
            # Ensure required fields with fallbacks
            article.setdefault('link', '#')
            article.setdefault('date', datetime.now().strftime("%Y-%m-%d"))
            
            # Add placeholder image and schedule background update
            article['imageUrl'] = "https://picsum.photos/seed/article/800/500"
            background_tasks.add_task(
                update_article_image,
                articles,
                article
            )
            
            valid_articles.append(article)

        if not valid_articles:
            return FALLBACK_ARTICLES

        set_cache(cache_key, valid_articles)
        return valid_articles

    except Exception as e:
        print(f"Articles API error: {str(e)}")
        return FALLBACK_ARTICLES

def update_article_image(articles_list, article):
    """Update article image URL in background"""
    try:
        image_url = fetch_pixabay_image(article.get('title', 'space'))
        for a in articles_list:
            if a.get('title') == article.get('title'):
                a['imageUrl'] = image_url
                break
    except Exception as e:
        print(f"Error updating article image: {str(e)}")

class ChatMessage(BaseModel):
    message: str

@app.post("/api/chat")
async def chat(data: ChatMessage):
    try:
        chat_context = [
            {"role": "system", "content": "You are a helpful space and astronomy assistant. Provide concise, accurate information about space, planets, stars, NASA missions, and astronomical phenomena. When appropriate, suggest stargazing tips or interesting facts about the cosmos."},
            {"role": "user", "content": data.message}
        ]
        
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "messages": chat_context,
            "model": "llama3-8b-8192",
            "temperature": 0.7,
            "max_tokens": 800,
        }
        
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            data=json.dumps(payload)
        )
        
        response_data = response.json()
        assistant_response = response_data['choices'][0]['message']['content']
        
        return {"response": assistant_response}
    except Exception as e:
        return {"error": str(e), "response": "Sorry, I encountered an error processing your request."}


if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)