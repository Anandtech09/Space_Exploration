# Space Exploration Project 🚀

Welcome to the **Space Exploration Project**, a web application built with React and TypeScript that allows users to explore space-related content, including NASA's Astronomy Picture of the Day (APOD), local space weather, upcoming SpaceX launches, and space articles. Additionally, the project features an interactive game called **Pixel Rocket**, where users can navigate a rocket to avoid enemies and collect coins.

This project combines educational content with interactive elements to engage users in the wonders of space exploration.

## Table of Contents
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Project Setup](#project-setup)
- [File Structure](#file-structure)
- [License](#license)

---

## Features

- **Astronomy Picture of the Day (APOD)**: Fetches and displays NASA's APOD with caching in `localStorage` to reduce API calls.
- **Local Space Weather**: Displays weather data based on the user's geolocation, including temperature, humidity, wind speed, and a forecast.
- **Space Articles**: Fetches and displays space-related articles, with a search functionality.
- **Upcoming SpaceX Launches**: Shows details of upcoming SpaceX launches using the SpaceX API.
- **Interactive 3D Solar System**: Visualizes a 3D solar system using Three.js (via the `SpaceJourney` component).
- **AI Chat Assistant**: Allows users to ask space-related questions via a chat interface.
- **Numerous Game**: Engages users with a variety of space-themed games, including SpaceRace and SpaceJump, that challenge players to navigate obstacles, collect items, and compete for high scores.
- **Dark Mode**: Toggle between light and dark themes for better user experience.
- **Responsive Design**: Optimized for both desktop and mobile devices.

---

## Technologies Used

- **Frontend**:
  - React (with TypeScript)
  - Tailwind CSS (for styling)
  - Three.js (for 3D visualizations in `SpaceJourney`)
  - Lucide React (for icons)
  - Axios (for API requests)
- **Backend** (assumed):
  - Flask (for API endpoints like `/api/space-weather`, `/api/nasa/apod`, `/api/articles`, `/api/chat`)
- **APIs**:
  - NASA OFFICIAL API
  - SpaceX API
  - Weather API
  - GROQ API for AI FEATURE
  - Custom Flask API for weather and chat functionality
- **Other**:
  - HTML5 Canvas (for the `SpaceJump` game)
  - LocalStorage (for caching APOD data and location permission status)

---

## Project Setup

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Python** (if running the Flask backend)
- A modern web browser (Chrome, Firefox, etc.)

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/space-exploration.git
   cd space-exploration
   ```

2. **Install Frontend Dependencies**:
   ```bash
   npm install
   ```
   or
   ```bash
   yarn install
   ```

3. **Set Up the Backend (Flask)**:
   - Navigate to the backend directory (if separate):
     ```bash
     cd api
     ```
   - Create a virtual environment and install dependencies:
     ```bash
     python -m venv venv
     source venv/bin/activate  # On Windows: venv\Scripts\activate
     pip install -r requirements.txt
     ```
   - Run the Flask server:
     ```bash
     python app.py
     ```
   - Ensure the Flask server runs on http://localhost:5000.

4. **Run the Frontend**:
   - From the project root, start the React development server:
     ```bash
     npm run dev
     ```
     or
     ```bash
     yarn start
     ```
   - Open your browser and navigate to http://localhost:5173.

### Environment Variables

Create a `.env` file in the project root and add any necessary environment variables, such as API keys for NASA or other services:
```plaintext
VITE_NASA_API_KEY=DEMO_KEY  #you can get personal api_key from nasa website
VITE_GROQ_API_KEY=your_groq_api
VITE_PIXABAY_API_KEY=your_pixabay_api  #for image finding
VITE_WEATHER_BASE_URL=https://www.7timer.info/bin/astro.php
BACKEND_API=(localhost:5000)-locally
```

---

## File Structure
```
space-exploration/
├── public/
│   ├── index.html
│   └── ...
├── src/
│   ├── components/
│   │   ├── SearchBar.tsx        # Search bar for articles
│   │   ├── SpaceJourney.tsx     # 3D solar system visualization
│   │   |── NasaStats.tsx
|   |   └── .....
│   ├── data/
|   ├── pages/ 
|   ├── types/
|   ├── data          
│   ├── App.tsx                  # App root component
│   ├── index.tsx                # Entry point
│   ├── styles/
│   │   └── tailwind.css         # Tailwind CSS configuration
│   └── ...
├── api/                     # Flask backend (if included)
│   ├── app.py                   # Flask app
│   ├── requirements.txt         # Backend dependencies
│   └── ...
├── README.md
├── package.json
└── tsconfig.json
```

## Hosted Link
- Front end: https://spaceexploration-production.up.railway.app/
- Backend: https://space-exploration-5x72.onrender.com/
