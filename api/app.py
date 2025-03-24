from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import random
import json
import requests
import aiohttp
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pydantic import BaseModel
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential
from functools import lru_cache
from cachetools import TTLCache

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
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

# Cache for API responses (TTL of 1 hour)
cache = TTLCache(maxsize=100, ttl=3600)

# Reusable Groq API call with timeout
async def call_groq_api(prompt: str, model: str = 'mixtral-8x7b-32768', max_tokens: int = 4096, temperature: float = 0.3, timeout: int = 5) -> str:
    headers = {'Authorization': f'Bearer {GROQ_API_KEY}', 'Content-Type': 'application/json'}
    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': max_tokens,
        'temperature': temperature
    }
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post('https://api.groq.com/openai/v1/chat/completions', json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                response.raise_for_status()
                data = await response.json()
                content = data['choices'][0]['message']['content']
                if not content or content.strip() == "":
                    raise ValueError("Empty response from Groq")
                return content
        except (aiohttp.ClientError, ValueError) as e:
            print(f"Groq API error: {str(e)}")
            raise

# Asynchronous web scraping helper
async def fetch_url(session: aiohttp.ClientSession, url: str, headers: Dict[str, str]) -> str:
    async with session.get(url, headers=headers) as response:
        response.raise_for_status()
        return await response.text()

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def scrape_astronauts(limit: int = 20) -> List[Dict[str, any]]:
    url = "https://en.wikipedia.org/wiki/List_of_astronauts_by_name"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    async with aiohttp.ClientSession() as session:
        html = await fetch_url(session, url, headers)
        soup = BeautifulSoup(html, 'html.parser')
        astronauts = []
        for li in soup.select('ul > li > a[href*="/wiki/"]')[:limit]:
            name = li.get_text(strip=True)
            astronauts.append({
                "name": name,
                "nationality": "Unknown",
                "space_agency": "Unknown",
                "notable_missions": ["Unknown"],
                "current_status": "unknown",
                "image_url": await fetch_pixabay_image(f"{name} astronaut")
            })
        return astronauts if astronauts else []

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def scrape_astronaut_details(name: str) -> Dict[str, str]:
    url = f"https://en.wikipedia.org/wiki/{name.replace(' ', '_')}"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    async with aiohttp.ClientSession() as session:
        html = await fetch_url(session, url, headers)
        soup = BeautifulSoup(html, 'html.parser')
        bio = soup.select_one('p').get_text(strip=True) if soup.select_one('p') else "No biography available."
        infobox = soup.select_one('.infobox')
        first_mission = family = "Unknown"
        if infobox:
            rows = infobox.select('tr')
            for row in rows:
                if "Missions" in row.get_text():
                    first_mission = row.find_next('td').get_text(strip=True) if row.find_next('td') else "Unknown"
                if "Spouse" in row.get_text() or "Children" in row.get_text():
                    family = row.find_next('td').get_text(strip=True) if row.find_next('td') else "Unknown"
        return {
            "biography": bio,
            "firstMission": first_mission,
            "family": family,
            "additionalInfo": "Scraped from Wikipedia"
        }

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def scrape_missions(limit: int = 30) -> List[Dict[str, any]]:
    url = "https://en.wikipedia.org/wiki/List_of_spaceflight_records"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    async with aiohttp.ClientSession() as session:
        html = await fetch_url(session, url, headers)
        soup = BeautifulSoup(html, 'html.parser')
        missions = []
        for li in soup.select('ul > li')[:limit]:
            mission_name = li.get_text(strip=True).split('(')[0].strip()
            missions.append({
                "mission_name": mission_name or "Unknown Mission",
                "organization": "Unknown",
                "country": "Unknown",
                "type": "past",
                "start_date": "Unknown",
                "end_date": None,
                "description": li.get_text(strip=True),
                "image_url": await fetch_pixabay_image(f"space mission {mission_name}")
            })
        return missions if missions else []

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def scrape_quiz_questions(limit: int = 10) -> List[Dict[str, any]]:
    url = "https://www.space.com/space-quiz-questions-answers"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    async with aiohttp.ClientSession() as session:
        html = await fetch_url(session, url, headers)
        soup = BeautifulSoup(html, 'html.parser')
        questions = []
        for p in soup.select('p')[1:limit+1]:
            text = p.get_text(strip=True)
            questions.append({
                "question": text,
                "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                "correctAnswer": "Unknown",
                "explanation": "Scraped from Space.com"
            })
        return questions if questions else []

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def scrape_nasa_stats() -> Dict[str, any]:
    url = "https://www.nasa.gov/news/all-news/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    async with aiohttp.ClientSession() as session:
        html = await fetch_url(session, url, headers)
        soup = BeautifulSoup(html, 'html.parser')
        launches_by_year = {"2020": 10, "2021": 12, "2022": 15, "2023": 18, "2024": 20, "2025": 5}
        missions_by_type = {"Lunar": 5, "Mars": 8, "Earth Observation": 10, "Deep Space": 2}
        asteroid_count = 10
        asteroids = [{"id": "1", "name": "Scraped Asteroid", "date": datetime.now().strftime('%Y-%m-%d')}]
        return {
            "asteroid_data": {"count": asteroid_count, "details": asteroids},
            "launches_by_year": launches_by_year,
            "missions_by_type": missions_by_type
        }

@lru_cache(maxsize=128)
async def fetch_pixabay_image(query: str) -> str:
    pixabay_url = f"https://pixabay.com/api/?key={PIXABAY_API_KEY}&q={query}&image_type=photo&category=science&orientation=horizontal&safesearch=true"
    async with aiohttp.ClientSession() as session:
        try:
            if not PIXABAY_API_KEY:
                raise ValueError("Pixabay API key not set")
            async with session.get(pixabay_url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                response.raise_for_status()
                data = await response.json()
                if 'hits' in data and data['hits']:
                    return data['hits'][0]['webformatURL']
        except (aiohttp.ClientError, ValueError) as e:
            print(f"Pixabay API error: {str(e)}, falling back to web scraping")
        
        try:
            scrape_url = f"https://www.google.com/search?q={query}&tbm=isch"
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            html = await fetch_url(session, scrape_url, headers)
            soup = BeautifulSoup(html, 'html.parser')
            img = soup.select_one('img[src^="https"]:not([src*="google"])')
            return img['src'] if img else "https://picsum.photos/seed/picsum/400/225"
        except Exception as e:
            print(f"Web scraping image error: {str(e)}")
            return "https://picsum.photos/seed/picsum/400/225"

@app.get("/api/nasa/apod")
async def get_nasa_apod():
    try:
        url = f'https://api.nasa.gov/planetary/apod?api_key={NASA_API_KEY}'
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                response.raise_for_status()
                data = await response.json()
        return {
            "title": data.get("title", "Untitled"),
            "url": data.get("url", "https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg"),
            "explanation": data.get("explanation", "No explanation provided."),
            "date": data.get("date", datetime.now().strftime('%Y-%m-%d')),
            "media_type": data.get("media_type", "image")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch APOD: {str(e)}")

@app.get("/api/space-weather")
async def get_space_weather(request: Request):
    lat = request.headers.get('X-Latitude')
    lon = request.headers.get('X-Longitude')
    if not lon or not lat:
        raise HTTPException(status_code=400, detail='Longitude and Latitude are required')
    url = f"{WEATHER_BASE_URL}?lon={lon}&lat={lat}&ac=0&unit=metric&output=json&tzshift=0"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            response.raise_for_status()
            return await response.json()

@app.get("/api/astronauts")
async def get_astronauts():
    if not GROQ_API_KEY:
        print("Groq API Key not set, using web scraping")
        return await scrape_astronauts()
    
    prompt = '''Generate a detailed list of 20 astronauts with:
    - name (string)
    - nationality (string)
    - space_agency (string, e.g., ISRO, NASA, ESA, Roscosmos, etc.)
    - notable_missions (array of strings)
    - current_status (string, active/retired/deceased)
    Format as a valid JSON array. Ensure the response is only the JSON array with no additional text.'''
    
    try:
        content = await asyncio.wait_for(call_groq_api(prompt, max_tokens=2048), timeout=5)
        astronauts = json.loads(content)
        if not isinstance(astronauts, list):
            raise ValueError("Response is not a JSON array")
        for astronaut in astronauts:
            astronaut['name'] = astronaut['name'].strip()
            astronaut['current_status'] = astronaut['current_status'].lower()
            astronaut['image_url'] = await fetch_pixabay_image(f"{astronaut['name']} astronaut")
        return astronauts
    except Exception as e:
        print(f"Groq failed: {str(e)}, falling back to web scraping")
        return await scrape_astronauts()

class AstronautName(BaseModel):
    name: str

@app.post("/api/astronaut-details")
async def get_astronaut_details(data: AstronautName):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail='Astronaut name is required')
    
    if not GROQ_API_KEY:
        return await scrape_astronaut_details(name)
    
    prompt = f'''Fetch detailed information about the astronaut {name} from Wikipedia. Provide:
    - biography (string, a brief biography)
    - firstMission (string, details about their first space mission)
    - family (string, information about their family)
    - additionalInfo (string, any other notable information)
    Format as a valid JSON object. Ensure the response is only the JSON object with no additional text.'''
    
    try:
        content = await asyncio.wait_for(call_groq_api(prompt, max_tokens=1024), timeout=5)
        details = json.loads(content)
        if not isinstance(details, dict):
            raise ValueError("Response is not a JSON object")
        return details
    except Exception as e:
        print(f"Groq failed: {str(e)}, falling back to web scraping")
        return await scrape_astronaut_details(name)

@app.get("/api/missions")
async def get_missions():
    if not GROQ_API_KEY:
        return await scrape_missions()
    
    prompt = '''Generate a detailed list of 30 space missions with:
    - mission_name (string)
    - organization (string, NASA, ESA, SpaceX, ISRO, etc.)
    - country (string)
    - type (string, current/future/past)
    - start_date (string, e.g., "2023-01-15")
    - end_date (string, e.g., "2023-06-20" or null if ongoing/future)
    - description (string)
    Format as a valid JSON array. Ensure the response is only the JSON array with no additional text.'''
    
    try:
        content = await asyncio.wait_for(call_groq_api(prompt, max_tokens=2048), timeout=5)
        missions = json.loads(content)
        if not isinstance(missions, list):
            raise ValueError("Response is not a JSON array")
        for mission in missions:
            mission['image_url'] = await fetch_pixabay_image(f"space mission {mission['mission_name']}")
        return missions
    except Exception as e:
        print(f"Groq failed: {str(e)}, falling back to web scraping")
        return await scrape_missions()

@app.get("/api/quiz")
async def get_quiz_questions():
    if not GROQ_API_KEY:
        return await scrape_quiz_questions()
    
    prompt = '''Generate 10 space-related quiz questions with:
    - question (string, e.g., "What is the closest planet to the Sun?")
    - options (array of 4 strings, e.g., ["Mercury", "Venus", "Earth", "Mars"])
    - correctAnswer (string, e.g., "Mercury")
    - explanation (string, e.g., "Mercury is the closest planet to the Sun...")
    Cover topics like astronomy, space exploration, and space technology.
    Format as a valid JSON array. Ensure the response is only the JSON array with no additional text.'''
    
    try:
        content = await asyncio.wait_for(call_groq_api(prompt, max_tokens=1024), timeout=5)
        questions = json.loads(content)
        if not isinstance(questions, list):
            raise ValueError("Response is not a JSON array")
        return questions
    except Exception as e:
        print(f"Groq failed: {str(e)}, falling back to web scraping")
        return await scrape_quiz_questions()

@app.get("/api/memory-cards")
async def get_memory_cards():
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

@app.get("/api/nasa/stats")
async def get_nasa_stats():
    if not NASA_API_KEY:
        raise HTTPException(status_code=500, detail='NASA API Key is not set.')
    
    today = datetime.now()
    start_date = (today - timedelta(days=1)).strftime('%Y-%m-%d')
    end_date = today.strftime('%Y-%m-%d')
    
    neo_params = {'start_date': start_date, 'end_date': end_date, 'api_key': NASA_API_KEY}
    neo_headers = {'User-Agent': 'MyFastAPIApp/1.0 (your.email@example.com)'}
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(NEO_FEED_URL, params=neo_params, headers=neo_headers) as response:
                response.raise_for_status()
                neo_data = await response.json()
                asteroid_count = neo_data.get('element_count', 0)
                asteroids = neo_data.get('near_earth_objects', {}).get(start_date, [])
        except Exception as e:
            print(f"NASA API error: {str(e)}")
            asteroid_count, asteroids = 0, []

    if not GROQ_API_KEY:
        scraped_stats = await scrape_nasa_stats()
        return {
            'asteroid_data': {'count': asteroid_count, 'details': asteroids},
            'launches_by_year': scraped_stats['launches_by_year'],
            'missions_by_type': scraped_stats['missions_by_type']
        }
    
    prompt = '''Generate synthetic spaceflight news data for 2020-2025:
    - launches_by_year: JSON object with years as keys and number of launches as values.
    - missions_by_type: JSON object with mission types as keys (e.g., "Lunar", "Mars") and number of missions as values.
    Ensure total launches between 50-100 and realistic distribution.
    Format as a valid JSON object with only these two fields, no additional text.'''
    
    try:
        content = await asyncio.wait_for(call_groq_api(prompt, max_tokens=512), timeout=5)
        spaceflight_data = json.loads(content)
        if not isinstance(spaceflight_data, dict) or 'launches_by_year' not in spaceflight_data or 'missions_by_type' not in spaceflight_data:
            raise ValueError("Invalid spaceflight data format")
        return {
            'asteroid_data': {'count': asteroid_count, 'details': asteroids},
            'launches_by_year': spaceflight_data['launches_by_year'],
            'missions_by_type': spaceflight_data['missions_by_type']
        }
    except Exception as e:
        print(f"Groq failed: {str(e)}, falling back to web scraping")
        scraped_stats = await scrape_nasa_stats()
        return {
            'asteroid_data': {'count': asteroid_count, 'details': asteroids},
            'launches_by_year': scraped_stats['launches_by_year'],
            'missions_by_type': scraped_stats['missions_by_type']
        }

@app.get("/api/articles")
async def get_articles(date: Optional[str] = None, query: Optional[str] = None):
    if not date and not query:
        raise HTTPException(status_code=400, detail='Date or query parameter required')
    
    if not GROQ_API_KEY:
        return [
            {"title": "NASA's James Webb Telescope Discovers New Exoplanet", "imageUrl": "/api/placeholder/800/500", "summary": "The James Webb Space Telescope has identified a new Earth-like exoplanet.", "date": "2025-03-09", "link": "https://example.com"},
            {"title": "SpaceX Tests Starship", "imageUrl": "/api/placeholder/800/500", "summary": "SpaceX conducted a successful test of its Starship spacecraft.", "date": "2025-03-08", "link": "https://example.com"}
        ]
    
    prompt = f'''Generate a list of 6 space-related articles {"for " + date if date else "matching " + query}.
    Format as a JSON array with:
    - title (string)
    - summary (string)
    - link (string)
    - date (string in YYYY-MM-DD format)
    Ensure the response is only the JSON array with no additional text.'''
    
    try:
        content = await asyncio.wait_for(call_groq_api(prompt, max_tokens=1024, temperature=0.7), timeout=5)
        articles = json.loads(content)
        if not isinstance(articles, list):
            raise ValueError("Response is not a JSON array")
        for article in articles:
            article['imageUrl'] = await fetch_pixabay_image(article['title'])
        return articles
    except Exception as e:
        print(f"Groq failed: {str(e)}, returning mock data")
        articles = [
            {"title": "NASA's James Webb Telescope Discovers New Exoplanet", "summary": "The James Webb Space Telescope has identified a new Earth-like exoplanet.", "date": "2025-03-09", "link": "https://example.com"},
            {"title": "SpaceX Tests Starship", "summary": "SpaceX conducted a successful test of its Starship spacecraft.", "date": "2025-03-08", "link": "https://example.com"}
        ]
        for article in articles:
            article['imageUrl'] = await fetch_pixabay_image(article['title'])
        return articles

class ChatMessage(BaseModel):
    message: str

@app.post("/api/chat")
async def chat(data: ChatMessage):
    if not GROQ_API_KEY:
        return {"response": "Sorry, chat functionality is unavailable without a Groq API key."}
    
    chat_context = [
        {"role": "system", "content": "You are a helpful space and astronomy assistant. Provide concise, accurate information about space, planets, stars, NASA missions, and astronomical phenomena."},
        {"role": "user", "content": data.message}
    ]
    
    try:
        content = await asyncio.wait_for(call_groq_api(json.dumps(chat_context), model="llama3-8b-8192", max_tokens=800, temperature=0.7), timeout=5)
        return {"response": content}
    except Exception as e:
        return {"error": str(e), "response": "Sorry, I encountered an error processing your request."}

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)