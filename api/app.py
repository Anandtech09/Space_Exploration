from flask import Flask, jsonify, request
from flask_cors import CORS
import os, random
import json
import requests
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# Environment variables
NASA_API_KEY = os.getenv('VITE_NASA_API_KEY')
GROQ_API_KEY = os.getenv('VITE_GROQ_API_KEY')
WEATHER_BASE_URL = os.getenv('VITE_WEATHER_BASE_URL')
PIXABAY_API_KEY = os.getenv('VITE_PIXABAY_API_KEY')
NEO_FEED_URL = 'https://api.nasa.gov/neo/rest/v1/feed'

@app.route('/api/nasa/apod', methods=['GET'])
def get_nasa_apod():
    try:
        url = f'https://api.nasa.gov/planetary/apod?api_key={NASA_API_KEY}'
        response = requests.get(url)
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/space-weather', methods=['GET'])
def get_space_weather():
    try:
        # Get latitude and longitude from the custom headers
        lat = request.headers.get('X-Latitude')
        lon = request.headers.get('X-Longitude')

        if not lon or not lat:
            return jsonify({'error': 'Longitude and Latitude are required'}), 400

        # Construct the API URL with parameters
        url = f"{WEATHER_BASE_URL}?lon={lon}&lat={lat}&ac=0&unit=metric&output=json&tzshift=0"
        print(url)

        # Fetch weather data
        response = requests.get(url)
        response.raise_for_status()

        return jsonify(response.json())

    except Exception as e:
        print(str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/astronauts', methods=['GET'])
def get_astronauts():
    try:
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }

        # Check if API key is available
        if not GROQ_API_KEY:
            return jsonify({'error': 'Groq API Key is not set. Please configure it in your environment variables.'}), 500

        payload = {
            'model': 'mixtral-8x7b-32768',
            'messages': [{
                'role': 'user',
                'content': '''Generate a detailed list of 40 astronauts with the following information:
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
        print("Groq content:", content)

        if not content or content.strip() == "":
            return jsonify({'error': 'Empty response from Groq'}), 500

        try:
            astronauts = json.loads(content)
            if not isinstance(astronauts, list):
                return jsonify({'error': 'Response is not a JSON array', 'raw_content': content}), 500

            # Validate and enhance astronaut data
            for astronaut in astronauts:
                if not isinstance(astronaut, dict) or \
                   'name' not in astronaut or \
                   'nationality' not in astronaut or \
                   'space_agency' not in astronaut or \
                   'notable_missions' not in astronaut or \
                   'current_status' not in astronaut:
                    return jsonify({'error': 'Invalid astronaut format', 'raw_content': content}), 500

                if not isinstance(astronaut['notable_missions'], list):
                    return jsonify({'error': 'Invalid notable_missions format: must be an array', 'raw_content': content}), 500

                # Fetch Pixabay image for the astronaut
                astronaut['image_url'] = fetch_pixabay_image(f"{astronaut['name']} astronaut")

            return jsonify(astronauts)
        
        except json.JSONDecodeError as e:
            print("Invalid JSON content:", content)
            return jsonify({'error': 'Invalid JSON from Groq', 'raw_content': content}), 500
            
    except Exception as e:
        print("Error:", str(e))
        return jsonify({'error': str(e)}), 500


@app.route('/api/missions', methods=['GET'])
def get_missions():
    try:
        if not GROQ_API_KEY:
            return jsonify({'error': 'Groq API Key is not set.'}), 500
        if not PIXABAY_API_KEY:
            return jsonify({'error': 'Pixabay API Key is not set.'}), 500
        
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
            return jsonify({'error': 'Empty response from Groq'}), 500

        try:
            missions = json.loads(content)
            if not isinstance(missions, list):
                return jsonify({'error': 'Response is not a JSON array', 'raw_content': content}), 500
            
            for mission in missions:
                if not isinstance(mission, dict) or \
                   'mission_name' not in mission or \
                   'organization' not in mission or \
                   'country' not in mission or \
                   'type' not in mission or \
                   'start_date' not in mission or \
                   'end_date' not in mission or \
                   'description' not in mission:
                    return jsonify({'error': 'Invalid mission format', 'raw_content': content}), 500

                # Fetch image from Pixabay
                image_url = fetch_pixabay_image('space mission'+mission['mission_name'])
                mission['image_url'] = image_url

            return jsonify(missions)

        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid JSON from Groq', 'raw_content': content}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/quiz', methods=['GET'])
def get_quiz_questions():
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
            'max_tokens': 2048,  # Increased to accommodate 10 questions
            'temperature': 0.3   # Lowered for stricter JSON adherence
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
            return jsonify({'error': 'Empty response from Groq'}), 500
        
        try:
            questions = json.loads(content)
            if not isinstance(questions, list):
                return jsonify({'error': 'Response is not a JSON array', 'raw_content': content}), 500
            
            # Validate each question has required fields
            for question in questions:
                if not isinstance(question, dict) or \
                   'question' not in question or \
                   'options' not in question or \
                   'correctAnswer' not in question or \
                   'explanation' not in question:
                    return jsonify({'error': 'Invalid question format', 'raw_content': content}), 500
                if not isinstance(question['options'], list) or len(question['options']) != 4:
                    return jsonify({'error': 'Invalid options format: must be an array of 4 strings', 'raw_content': content}), 500
            
            return jsonify(questions)
        except json.JSONDecodeError as e:
            print("Invalid JSON content:", content)
            return jsonify({'error': 'Invalid JSON from Groq', 'raw_content': content}), 500
            
    except Exception as e:
        print("Error:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/memory-cards', methods=['GET'])
def get_memory_cards():
    try:
        # Hardcoded list of 8 space-related items with direct NASA image URLs
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
        
        # Shuffle the list randomly
        shuffled_items = space_items.copy()  # Create a copy to avoid modifying the original
        random.shuffle(shuffled_items)
        
        # Return the shuffled list as JSON
        return jsonify(shuffled_items)
        
    except Exception as e:
        print("Error:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/nasa/stats', methods=['GET'])
def get_nasa_stats():
    try:
        # Check if NASA API key is set
        if not NASA_API_KEY:
            return jsonify({'error': 'NASA API Key is not set. Please configure it in your environment variables.'}), 500

        # Use a recent date range for testing
        today = datetime(2025, 3, 11)
        start_date = (today - timedelta(days=1)).strftime('%Y-%m-%d')  # 2025-03-10
        end_date = today.strftime('%Y-%m-%d')  # 2025-03-11

        # Fetch asteroid data from NASA's NEO Feed API
        neo_params = {
            'start_date': start_date,
            'end_date': end_date,
            'api_key': NASA_API_KEY
        }
        neo_headers = {
            'User-Agent': 'MyFlaskApp/1.0 (your.email@example.com)'
        }
        neo_response = requests.get(
            NEO_FEED_URL,
            params=neo_params,
            headers=neo_headers
        )
        neo_response.raise_for_status()
        neo_data = neo_response.json()

        # Extract asteroid statistics
        asteroid_count = neo_data.get('element_count', 0)
        asteroids = neo_data.get('near_earth_objects', {}).get(start_date, [])

        # Check if Groq API key is set
        if not GROQ_API_KEY:
            return jsonify({'error': 'Groq API Key is not set. Please configure it in your environment variables.'}), 500

        # Use Groq to generate synthetic spaceflight news data
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
            return jsonify({'error': 'Empty response from Groq'}), 500

        try:
            spaceflight_data = json.loads(content)
            if not isinstance(spaceflight_data, dict) or \
               'launches_by_year' not in spaceflight_data or \
               'missions_by_type' not in spaceflight_data:
                return jsonify({'error': 'Invalid spaceflight data format', 'raw_content': content}), 500
        except json.JSONDecodeError as e:
            print("Invalid JSON content:", content)
            return jsonify({'error': 'Invalid JSON from Groq', 'raw_content': content}), 500

        # Prepare statistics for response
        stats = {
            'asteroid_data': {
                'count': asteroid_count,
                'details': asteroids
            },
            'launches_by_year': spaceflight_data['launches_by_year'],
            'missions_by_type': spaceflight_data['missions_by_type']
        }

        return jsonify(stats)

    except Exception as e:
        print("Error:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/articles', methods=['GET'])
def get_articles():
    try:
        date = request.args.get('date')
        query = request.args.get('query')

        if not date and not query:
            return jsonify({'error': 'Date or query parameter required'}), 400

        # Mock data for testing if no API key is available
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
            return jsonify(mock_articles)

        # Groq API endpoint
        groq_url = 'https://api.groq.com/openai/v1/chat/completions'
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }

        # Structured prompt
        prompt = f'''Generate a list of 6 space-related articles {"for " + date if date else "matching " + query}.
        
        Format the output as a JSON array where each object has these exact keys:
        - title (string)
        - summary (string)
        - link (string)
        - date (string in YYYY-MM-DD format)

        The response should be ONLY the JSON array with no other text.'''

        payload = {
            'model': 'mixtral-8x7b-32768',
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': 1024,
            'temperature': 0.7
        }

        response = requests.post(groq_url, json=payload, headers=headers)
        response.raise_for_status()

        # Extract response
        groq_response = response.json()
        articles_text = groq_response.get('choices', [{}])[0].get('message', {}).get('content', '')

        if not articles_text:
            return jsonify({'error': 'Empty response from Groq'}), 500

        # Clean JSON response from Groq
        articles_text = articles_text.strip().strip("```json").strip("```")
        
        try:
            articles = json.loads(articles_text)
        except json.JSONDecodeError as e:
            print(f"JSON Error: {e}")
            return jsonify({'error': 'Invalid JSON response from Groq', 'raw_response': articles_text[:500]}), 500

        # Fetch images using Pixabay
        for article in articles:
            article['imageUrl'] = fetch_pixabay_image(article['title'])

        return jsonify(articles)

    except requests.RequestException as e:
        print(f"Groq API error: {str(e)}")
        return jsonify({'error': f'Groq API error: {str(e)}'}), 500
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


def fetch_pixabay_image(query):
    """
    Fetches a space-related image URL from Pixabay based on the given query.
    """
    pixabay_url = f"https://pixabay.com/api/?key={PIXABAY_API_KEY}&q={query}&image_type=photo&category=science&orientation=horizontal&safesearch=true"

    try:
        response = requests.get(pixabay_url)
        response.raise_for_status()
        data = response.json()
        
        if 'hits' in data and data['hits']:
            return data['hits'][0]['webformatURL']
        else:
            return "https://picsum.photos/seed/picsum/400/225"  # Default placeholder if no image found
    except requests.RequestException as e:
        print(f"Pixabay API error: {str(e)}")
        return "https://picsum.photos/seed/picsum/400/225"

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_message = data.get('message', '')
        
        # Prepare the chat context
        chat_context = [
            {"role": "system", "content": "You are a helpful space and astronomy assistant. Provide concise, accurate information about space, planets, stars, NASA missions, and astronomical phenomena. When appropriate, suggest stargazing tips or interesting facts about the cosmos."},
            {"role": "user", "content": user_message}
        ]
        
        # Call Groq API
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "messages": chat_context,
            "model": "llama3-8b-8192",  # Or whichever model you prefer
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
        
        return jsonify({"response": assistant_response})
    except Exception as e:
        return jsonify({'error': str(e), 'response': 'Sorry, I encountered an error processing your request.'}), 500        

if __name__ == '__main__':
    app.run(debug=True, port=5000)