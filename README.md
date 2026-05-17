# Text on Media Editor

A Flask-based web application for overlaying customizable text on images and videos.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
```

2. Activate the virtual environment:
- Windows: `venv\Scripts\activate`
- Linux/Mac: `source venv/bin/activate`

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Run the Application

```bash
python app.py
```

Open your browser and go to `http://localhost:5000`

## Features

- Upload images (PNG, JPG, GIF, BMP, WEBP) or videos (MP4, AVI, MOV, MKV, WEBM)
- Customize text: content, font size, position, color, opacity
- Font styling: bold, italic, shadow
- Real-time preview
- Download processed media with text burned in

## Project Structure

```
editor/
├── app.py              # Flask backend
├── requirements.txt    # Python dependencies
├── .env               # Environment variables
├── templates/
│   └── editor.html    # Main editor page
├── static/
│   ├── css/
│   │   └── editor.css # Styles
│   └── js/
│       └── editor.js  # Frontend logic
├── uploads/           # Temporary upload storage
└── output/           # Processed output files
```