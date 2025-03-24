from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import random
import json
import requests
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

@app.get("/api/nasa/apod")
async def get_nasa_apod():
    try:
        url = f'https://api.nasa.gov/planetary/apod?api_key={NASA_API_KEY}'
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/space-weather")
async def get_space_weather(request: Request):
    try:
        lat = request.headers.get('X-Latitude')
        lon = request.headers.get('X-Longitude')

        if not lon or not lat:
            raise HTTPException(status_code=400, detail='Longitude and Latitude are required')

        url = f"{WEATHER_BASE_URL}?lon={lon}&lat={lat}&ac=0&unit=metric&output=json&tzshift=0"
        print(url)

        response = requests.get(url)
        response.raise_for_status()

        return response.json()
    except Exception as e:
        print(str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/astronauts")
async def get_astronauts():
    try:
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }

        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail='Groq API Key is not set.')

        payload = {
            'model': 'mixtral-8x7b-32768',
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
            'max_tokens': 4096,
            'temperature': 0.3
        }

        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            json=payload,
            headers=headers
        )
        response.raise_for_status()

        response_data = response.json()
        content = response_data['choices'][0]['message']['content']
        print("Groq content:", content)

        if not content or content.strip() == "":
            raise HTTPException(status_code=500, detail='Empty response from Groq')

        content = content.strip()
        if content.endswith(','):
            content = content[:-1]
        if not content.endswith(']'):
            content += ']'
        if not content.startswith('['):
            content = '[' + content

        try:
            astronauts = json.loads(content)
            if not isinstance(astronauts, list):
                raise HTTPException(status_code=500, detail='Response is not a JSON array', extra={'raw_content': content})

            for astronaut in astronauts:
                if not isinstance(astronaut, dict) or \
                   'name' not in astronaut or \
                   'nationality' not in astronaut or \
                   'space_agency' not in astronaut or \
                   'notable_missions' not in astronaut or \
                   'current_status' not in astronaut:
                    raise HTTPException(status_code=500, detail='Invalid astronaut format', extra={'raw_content': content})

                if not isinstance(astronaut['notable_missions'], list):
                    raise HTTPException(status_code=500, detail='Invalid notable_missions format', extra={'raw_content': content})

                astronaut['name'] = astronaut['name'].strip()
                astronaut['current_status'] = astronaut['current_status'].lower()
                astronaut['image_url'] = fetch_pixabay_image(f"{astronaut['name']} astronaut")

            return astronauts
        except json.JSONDecodeError as e:
            print("Invalid JSON content:", content)
            raise HTTPException(status_code=500, detail='Invalid JSON from Groq', extra={'raw_content': content})
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

class SearchQuery(BaseModel):
    query: str

@app.post("/api/search-astronauts")
async def search_astronauts(query: SearchQuery):
    try:
        if not query.query:
            raise HTTPException(status_code=400, detail='Search query is required')

        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }

        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail='Groq API Key is not set.')

        payload = {
            'model': 'mixtral-8x7b-32768',
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

        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            json=payload,
            headers=headers
        )
        response.raise_for_status()

        response_data = response.json()
        content = response_data['choices'][0]['message']['content']
        print("Groq search content:", content)

        if not content or content.strip() == "":
            raise HTTPException(status_code=500, detail='Empty response from Groq')

        content = content.strip()
        if content.endswith(','):
            content = content[:-1]
        if not content.endswith(']'):
            content += ']'
        if not content.startswith('['):
            content = '[' + content

        try:
            astronauts = json.loads(content)
            if not isinstance(astronauts, list):
                raise HTTPException(status_code=500, detail='Response is not a JSON array', extra={'raw_content': content})

            for astronaut in astronauts:
                if not isinstance(astronaut, dict) or \
                   'name' not in astronaut or \
                   'nationality' not in astronaut or \
                   'space_agency' not in astronaut or \
                   'notable_missions' not in astronaut or \
                   'current_status' not in astronaut:
                    raise HTTPException(status_code=500, detail='Invalid astronaut format', extra={'raw_content': content})

                if not isinstance(astronaut['notable_missions'], list):
                    raise HTTPException(status_code=500, detail='Invalid notable_missions format', extra={'raw_content': content})

                astronaut['name'] = astronaut['name'].strip()
                astronaut['current_status'] = astronaut['current_status'].lower()
                astronaut['image_url'] = fetch_pixabay_image(f"{astronaut['name']} astronaut")

            return astronauts
        except json.JSONDecodeError as e:
            print("Invalid JSON content:", content)
            raise HTTPException(status_code=500, detail='Invalid JSON from Groq', extra={'raw_content': content})
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

class AstronautName(BaseModel):
    name: str

@app.post("/api/astronaut-details")
async def get_astronaut_details(data: AstronautName):
    try:
        if not data.name:
            raise HTTPException(status_code=400, detail='Astronaut name is required')

        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }

        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail='Groq API Key is not set.')

        payload = {
            'model': 'mixtral-8x7b-32768',
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

        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            json=payload,
            headers=headers
        )
        response.raise_for_status()

        response_data = response.json()
        content = response_data['choices'][0]['message']['content']

        if not content or content.strip() == "":
            raise HTTPException(status_code=500, detail='Empty response from Groq')

        try:
            details = json.loads(content)
            if not isinstance(details, dict):
                raise HTTPException(status_code=500, detail='Response is not a JSON object', extra={'raw_content': content})

            required_fields = ['biography', 'firstMission', 'family', 'additionalInfo']
            for field in required_fields:
                if field not in details or not isinstance(details[field], str):
                    raise HTTPException(status_code=500, detail=f'Missing or invalid field: {field}', extra={'raw_content': content})

            return details
        except json.JSONDecodeError as e:
            print("Invalid JSON content:", content)
            raise HTTPException(status_code=500, detail='Invalid JSON from Groq', extra={'raw_content': content})
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/missions")
async def get_missions():
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail='Groq API Key is not set.')
        if not PIXABAY_API_KEY:
            raise HTTPException(status_code=500, detail='Pixabay API Key is not set.')
        
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }

        payload = {
            'model': 'mixtral-8x7b-32768',
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
            'max_tokens': 4096,
            'temperature': 0.3
        }

        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            json=payload,
            headers=headers
        )
        response.raise_for_status()

        response_data = response.json()
        content = response_data['choices'][0]['message']['content']
        print("Raw Groq response content:", content)

        if not content or content.strip() == "":
            raise HTTPException(status_code=500, detail='Empty response from Groq')

        content = content.strip()
        if content.startswith('[') and not content.endswith(']'):
            content += ']'
            open_braces = content.count('{') - content.count('}')
            open_brackets = content.count('[') - content.count(']')
            if open_braces > 0:
                content += '}' * open_braces
            if open_brackets > 0:
                content += ']' * open_brackets
            if content.endswith(','):
                content = content[:-1] + '}'

        try:
            missions = json.loads(content)
            if not isinstance(missions, list):
                raise HTTPException(status_code=500, detail='Response is not a JSON array', extra={'raw_content': content})
            
            for mission in missions:
                if not isinstance(mission, dict) or \
                   'mission_name' not in mission or \
                   'organization' not in mission or \
                   'country' not in mission or \
                   'type' not in mission or \
                   'start_date' not in mission or \
                   'end_date' not in mission or \
                   'description' not in mission:
                    raise HTTPException(status_code=500, detail='Invalid mission format', extra={'raw_content': content})

                mission['image_url'] = fetch_pixabay_image('space mission ' + mission['mission_name'])

            return missions
        except json.JSONDecodeError as e:
            print("Invalid JSON content after repair:", content)
            raise HTTPException(status_code=500, detail='Invalid JSON from Groq', extra={'raw_content': content})
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quiz")
async def get_quiz_questions():
    try:
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': 'mixtral-8x7b-32768',
            'messages': [{
                'role': 'user',
                'content': '''Generate 10 space-related quiz questions with:
                - question (string, e.g., "What is the closest planet to the Sun?")
                - options (array of 4 strings, e.g., ["Mercury", "Venus", "Earth", "Mars"])
                - correctAnswer (string, e.g., "Mercury")
                - explanation (string, e.g., "Mercury is the closest planet to the Sun, orbiting at an average distance of 58 million kilometers.")
                Cover topics like astronomy, space exploration, and space technology.
                Return the result as a valid JSON array. Ensure the response is only the JSON array with no additional text or explanations outside the array.
                Example format:
                [
                    {
                        "question": "What is the closest planet to the Sun?",
                        "options": ["Mercury", "Venus", "Earth", "Mars"],
                        "correctAnswer": "Mercury",
                        "explanation": "Mercury is the closest planet to the Sun, orbiting at an average distance of 58 million kilometers."
                    }
                ]
                '''
            }],
            'max_tokens': 2048,
            'temperature': 0.3
        }
        
        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            json=payload,
            headers=headers
        )
        response.raise_for_status()
        
        response_data = response.json()
        content = response_data['choices'][0]['message']['content']
        print("Groq content:", content)
        
        if not content or content.strip() == "":
            raise HTTPException(status_code=500, detail='Empty response from Groq')
        
        try:
            questions = json.loads(content)
            if not isinstance(questions, list):
                raise HTTPException(status_code=500, detail='Response is not a JSON array', extra={'raw_content': content})
            
            for question in questions:
                if not isinstance(question, dict) or \
                   'question' not in question or \
                   'options' not in question or \
                   'correctAnswer' not in question or \
                   'explanation' not in question:
                    raise HTTPException(status_code=500, detail='Invalid question format', extra={'raw_content': content})
                if not isinstance(question['options'], list) or len(question['options']) != 4:
                    raise HTTPException(status_code=500, detail='Invalid options format', extra={'raw_content': content})
            
            return questions
        except json.JSONDecodeError as e:
            print("Invalid JSON content:", content)
            raise HTTPException(status_code=500, detail='Invalid JSON from Groq', extra={'raw_content': content})
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/memory-cards")
async def get_memory_cards():
    try:
        space_items = [
            {"name": "Mars", "image_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRgXBghYx2s8GqEqwY1qVFmZl05KXEnKb5IqA&s"},
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
        
        return shuffled_items
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

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
async def get_articles(date: Optional[str] = None, query: Optional[str] = None):
    try:
        if not date and not query:
            raise HTTPException(status_code=400, detail='Date or query parameter required')

        if not GROQ_API_KEY:
            mock_articles = [
                {
                    "title": "NASA's James Webb Telescope Discovers New Exoplanet",
                    "imageUrl": "/api/placeholder/800/500",
                    "summary": "The James Webb Space Telescope has identified a new Earth-like exoplanet in the habitable zone.",
                    "date": "2025-03-09"
                },
                {
                    "title": "SpaceX Successfully Tests Starship Orbital Flight",
                    "imageUrl": "/api/placeholder/800/500",
                    "summary": "SpaceX conducted another successful test of its Starship spacecraft, bringing us one step closer to Mars.",
                    "date": "2025-03-08"
                }
            ]
            return mock_articles

        groq_url = 'https://api.groq.com/openai/v1/chat/completions'
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }

        prompt = f'''Generate a list of 6 space-related articles {"for " + date if date else "matching " + query}.
        
        Format the output as a JSON array where each object has these exact keys:
        - title (string)
        - summary (string)
        - link (string)
        - date (string in YYYY-MM-DD format)

        The response should be ONLY the JSON array with no other text.'''

        # List of fallback models to try
        groq_models = [
            'mixtral-8x7b-32768',  # Primary model
            'llama3-8b-8192',      # Fallback model 1
            'gemma-7b-it'          # Fallback model 2 (if available)
        ]

        for model in groq_models:
            payload = {
                'model': model,
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 1024,
                'temperature': 0.7
            }

            try:
                print(f"Trying model: {model}")  # Debug log
                response = requests.post(groq_url, json=payload, headers=headers)
                response.raise_for_status()
                break  # If successful, exit the loop
            except requests.RequestException as e:
                print(f"Error with model {model}: {str(e)}")
                if model == groq_models[-1]:  # If last model fails, raise exception
                    raise HTTPException(status_code=500, detail=f'All Groq models failed. Last error: {str(e)}')
                continue  # Try the next model

        groq_response = response.json()
        articles_text = groq_response.get('choices', [{}])[0].get('message', {}).get('content', '')

        if not articles_text:
            raise HTTPException(status_code=500, detail='Empty response from Groq')

        articles_text = articles_text.strip().strip("```json").strip("```")
        
        try:
            articles = json.loads(articles_text)
            if not isinstance(articles, list):
                raise ValueError("Response is not a JSON array")
        except json.JSONDecodeError as e:
            print(f"JSON Error: {e}, Raw response: {articles_text[:500]}")
            raise HTTPException(status_code=500, detail='Invalid JSON response from Groq', extra={'raw_response': articles_text[:500]})

        for article in articles:
            if not all(key in article for key in ['title', 'summary', 'link', 'date']):
                raise HTTPException(status_code=500, detail='Invalid article format', extra={'article': article})
            article['imageUrl'] = fetch_pixabay_image(article['title'])

        return articles

    except requests.RequestException as e:
        print(f"Groq API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f'Groq API error: {str(e)}')
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f'Internal server error: {str(e)}')
        
def fetch_pixabay_image(query: str) -> str:
    pixabay_url = f"https://pixabay.com/api/?key={PIXABAY_API_KEY}&q={query}&image_type=photo&category=science&orientation=horizontal&safesearch=true"
    try:
        response = requests.get(pixabay_url)
        response.raise_for_status()
        data = response.json()
        
        if 'hits' in data and data['hits']:
            return data['hits'][0]['webformatURL']
        return "https://picsum.photos/seed/picsum/400/225"
    except requests.RequestException as e:
        print(f"Pixabay API error: {str(e)}")
        return "https://picsum.photos/seed/picsum/400/225"

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