import os
import requests
import base64
import json
from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from PIL import Image, ImageDraw, ImageFont
from dotenv import load_dotenv
import cv2
import numpy as np
from io import BytesIO

load_dotenv()

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "output")

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["OUTPUT_FOLDER"] = OUTPUT_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

ALLOWED_IMAGE = {"png", "jpg", "jpeg", "gif", "bmp", "webp"}
ALLOWED_VIDEO = {"mp4", "avi", "mov", "mkv", "webm"}

INSTAGRAM_FORMATS = {
    "square": (1080, 1080),
    "portrait": (1080, 1350),
    "landscape": (1080, 566),
}

OLLAMA_URL = "http://localhost:11434"


def resize_for_instagram(image_path, output_path, format_type="portrait"):
    if format_type == "original":
        return image_path
    
    target_width, target_height = INSTAGRAM_FORMATS.get(format_type, (1080, 1350))
    
    img = Image.open(image_path).convert("RGB")
    orig_width, orig_height = img.size
    
    aspect = orig_width / orig_height
    target_aspect = target_width / target_height
    
    if aspect > target_aspect:
        new_width = int(orig_height * target_aspect)
        left = (orig_width - new_width) // 2
        img = img.crop((left, 0, left + new_width, orig_height))
    else:
        new_height = int(orig_width / target_aspect)
        top = (orig_height - new_height) // 2
        img = img.crop((0, top, orig_width, top + new_height))
    
    img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
    img.save(output_path, quality=95)
    return output_path

def check_ollama():
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        return response.status_code == 200
    except:
        return False

def load_font(font_size=36, font_name="arial.ttf"):
    font_paths = [
        f"C:/Windows/Fonts/{font_name}",
        f"/usr/share/fonts/truetype/dejavu/{font_name}",
        f"/usr/share/fonts/truetype/liberation/{font_name}",
        "static/fonts/Roboto-Regular.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, font_size)
            except:
                pass
    return ImageFont.load_default()

def detect_faces_opencv(image_path):
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    
    img_height, img_width = img.shape[:2]
    
    detected_faces = []
    
    for i, (x, y, w, h) in enumerate(faces):
        center_x = x + w // 2
        center_y = y + h // 2
        
        pos_x_percent = round((center_x / img_width) * 100, 1)
        pos_y_percent = round(((y + h + 20) / img_height) * 100, 1)
        
        detected_faces.append({
            "id": i,
            "x": pos_x_percent,
            "y": pos_y_percent,
            "face_x": x,
            "face_y": y,
            "face_w": w,
            "face_h": h,
            "name": f"Person {i + 1}"
        })
    
    return detected_faces

def encode_image_to_base64(image_path):
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode('utf-8')

def analyze_image_with_llava(image_path, user_context):
    image_base64 = encode_image_to_base64(image_path)
    
    prompt = f"""You are analyzing an image for creating a meme. 

User's context/scenario: "{user_context}"

Your task:
1. Identify ALL visible people/characters in this image (up to 5 people)
2. For each person, provide:
   - A descriptive label based on the user's context (e.g., "BJP", "Congress", etc.)
   - Their approximate position (left, center-left, center, center-right, right)
   - A brief description of their appearance/position in the image

3. Suggest a funny/catchy meme caption for BOTTOM of the image that relates to the user's context

4. If there are faces detected, estimate their positions as percentages (x%, y%) where they are located in the image

Return your response as a JSON object with this exact structure:
{{
    "people": [
        {{
            "label": "BJP",
            "position": "left",
            "position_x_percent": 25,
            "position_y_percent": 45,
            "description": "Person on the left side"
        }}
    ],
    "meme_caption": "Your suggested caption here",
    "bottom_text": "Additional bottom text if needed"
}}

Only return valid JSON, no markdown formatting."""

    payload = {
        "model": "llava",
        "prompt": prompt,
        "images": [image_base64],
        "stream": False
    }
    
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json=payload,
            timeout=120
        )
        
        if response.status_code == 200:
            result = response.json()
            response_text = result.get("response", "")
            
            try:
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                json_str = response_text[json_start:json_end]
                return json.loads(json_str)
            except:
                return {
                    "people": [],
                    "meme_caption": response_text[:200],
                    "bottom_text": "",
                    "raw_response": response_text
                }
        else:
            return {"error": f"Ollama error: {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

def apply_text_to_image(image_path, text_labels, bottom_text, output_path):
    img = Image.open(image_path).convert("RGBA")
    img_width, img_height = img.size
    overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)
    
    for label in text_labels:
        text = label.get("text", "")
        x_percent = label.get("x", 50)
        y_percent = label.get("y", 50)
        font_size = label.get("fontSize", 32)
        color = label.get("color", "#FF0000")
        opacity = label.get("opacity", 100)
        bg_enabled = label.get("bgEnabled", True)
        
        x = int(x_percent / 100 * img_width)
        y = int(y_percent / 100 * img_height)
        
        font = load_font(font_size, "arial.ttf")
        
        if color.startswith("#"):
            r = int(color[1:3], 16)
            g = int(color[3:5], 16)
            b = int(color[5:7], 16)
            text_color = (r, g, b, int(opacity * 2.55))
            bg_color = (0, 0, 0, int(180))
        else:
            text_color = (255, 0, 0, int(opacity * 2.55))
            bg_color = (0, 0, 0, int(180))
        
        bbox = draw.textbbox((x, y), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        text_x = x - text_width // 2
        text_y = y - text_height
        
        if bg_enabled:
            padding = 8
            draw.rectangle(
                [text_x - padding, text_y - padding, text_x + text_width + padding, text_y + text_height + padding],
                fill=bg_color
            )
        
        draw.text((text_x, text_y), text, font=font, fill=text_color)
    
    if bottom_text:
        font_size = int(min(img_width, img_height) * 0.04)
        font_size = max(20, min(font_size, 60))
        font = load_font(font_size, "arial.ttf")
        
        bbox = draw.textbbox((0, 0), bottom_text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        bottom_y = img_height - text_height - 30
        
        text_x = (img_width - text_width) // 2
        draw.text((text_x, bottom_y), bottom_text, font=font, fill=(255, 255, 255, 255))
    
    img = Image.alpha_composite(img, overlay)
    
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.save(output_path, quality=95)
    return output_path

def apply_text_to_video(video_path, text_labels, output_path):
    cap = cv2.VideoCapture(video_path)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    for label in text_labels:
        label["default_x"] = label.get("x", 50)
        label["default_y"] = label.get("y", 50)
    
    frame_num = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        current_time = frame_num / fps if fps > 0 else 0
        
        for label in text_labels:
            text = label.get("text", "")
            font_size = label.get("fontSize", 32)
            color_hex = label.get("color", "#FFFFFF")
            opacity = label.get("opacity", 100) / 100.0
            keyframes = label.get("keyframes", [])
            default_x = label.get("default_x", 50)
            default_y = label.get("default_y", 50)
            
            if keyframes and len(keyframes) > 0:
                posX, posY = get_position_at_time(keyframes, current_time, default_x, default_y)
            else:
                posX = default_x
                posY = default_y
            
            x_px = int(posX / 100 * width)
            y_px = int(posY / 100 * height)
            
            font_scale = font_size / 48.0
            thickness = 2
            
            (text_width, text_height), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
            
            font_x = x_px - text_width // 2
            font_y = y_px + text_height // 2
            
            if color_hex.startswith("#"):
                r = int(color_hex[1:3], 16)
                g = int(color_hex[3:5], 16)
                b = int(color_hex[5:7], 16)
                color = (int(b * opacity), int(g * opacity), int(r * opacity))
            else:
                color = (255, 255, 255)
            
            bg_padding = 10
            bg_x1 = max(0, font_x - bg_padding)
            bg_y1 = max(0, font_y - text_height - bg_padding)
            bg_x2 = min(width, font_x + text_width + bg_padding)
            bg_y2 = min(height, font_y + bg_padding)
            
            overlay = frame.copy()
            cv2.rectangle(overlay, (bg_x1, bg_y1), (bg_x2, bg_y2), (0, 0, 0), -1)
            frame = cv2.addWeighted(overlay, 0.4, frame, 0.6, 0)
            
            cv2.putText(frame, text, (font_x + 2, font_y + 2), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), thickness + 1, cv2.LINE_AA)
            cv2.putText(frame, text, (font_x, font_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, thickness, cv2.LINE_AA)
        
        out.write(frame)
        frame_num += 1
    
    cap.release()
    out.release()
    return output_path

def get_position_at_time(keyframes, time, default_x, default_y):
    if not keyframes or len(keyframes) == 0:
        return default_x, default_y
    
    if len(keyframes) == 1:
        return keyframes[0].get("posX", default_x), keyframes[0].get("posY", default_y)
    
    prev_kf = keyframes[0]
    next_kf = keyframes[-1]
    
    for i in range(len(keyframes) - 1):
        if time >= keyframes[i]["time"] and time <= keyframes[i + 1]["time"]:
            prev_kf = keyframes[i]
            next_kf = keyframes[i + 1]
            break
    
    if time <= prev_kf["time"]:
        return prev_kf.get("posX", default_x), prev_kf.get("posY", default_y)
    if time >= next_kf["time"]:
        return next_kf.get("posX", default_x), next_kf.get("posY", default_y)
    
    t = (time - prev_kf["time"]) / (next_kf["time"] - prev_kf["time"])
    x = int(prev_kf.get("posX", default_x) + (next_kf.get("posX", default_x) - prev_kf.get("posX", default_x)) * t)
    y = int(prev_kf.get("posY", default_y) + (next_kf.get("posY", default_y) - prev_kf.get("posY", default_y)) * t)
    
    return x, y

@app.route("/")
def index():
    return render_template("editor.html")

@app.route("/api/status")
def status():
    ollama_available = check_ollama()
    return jsonify({
        "ollama_available": ollama_available,
        "message": "Ollama is running" if ollama_available else "Ollama is not available"
    })

@app.route("/detect-faces", methods=["POST"])
def detect_faces_route():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files["file"]
        
        if file.filename == "":
            return jsonify({"error": "No file selected"}), 400
        
        filename = secure_filename(file.filename)
        ext = filename.rsplit(".", 1)[1].lower()
        
        if ext not in ALLOWED_IMAGE:
            return jsonify({"error": "Only images are supported for face detection"}), 400
        
        timestamp = int(os.path.getmtime(BASE_DIR))
        filepath = os.path.join(UPLOAD_FOLDER, f"{timestamp}_{filename}")
        file.save(filepath)
        
        faces = detect_faces_opencv(filepath)
        
        return jsonify({
            "faces": faces,
            "filepath": filepath,
            "filename": f"{timestamp}_{filename}"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/analyze-with-ai", methods=["POST"])
def analyze_with_ai():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files["file"]
        context = request.form.get("context", "")
        
        if file.filename == "":
            return jsonify({"error": "No file selected"}), 400
        
        if not context.strip():
            return jsonify({"error": "Please provide context for the meme"}), 400
        
        filename = secure_filename(file.filename)
        ext = filename.rsplit(".", 1)[1].lower()
        
        if ext not in ALLOWED_IMAGE:
            return jsonify({"error": "Only images are supported for AI analysis"}), 400
        
        timestamp = int(os.path.getmtime(BASE_DIR))
        filepath = os.path.join(UPLOAD_FOLDER, f"{timestamp}_{filename}")
        file.save(filepath)
        
        ollama_available = check_ollama()
        
        if not ollama_available:
            return jsonify({
                "error": "Ollama is not running. Please start Docker with: docker compose up -d"
            }), 503
        
        analysis = analyze_image_with_llava(filepath, context)
        
        if "error" in analysis:
            return jsonify(analysis), 500
        
        return jsonify({
            "analysis": analysis,
            "filepath": filepath,
            "filename": f"{timestamp}_{filename}"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/upload", methods=["POST"])
def upload_file():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files["file"]
        
        if file.filename == "":
            return jsonify({"error": "No file selected"}), 400
        
        filename = secure_filename(file.filename)
        
        if "." not in filename:
            return jsonify({"error": "Invalid file name"}), 400
        
        ext = filename.rsplit(".", 1)[1].lower()
        
        if ext not in ALLOWED_IMAGE and ext not in ALLOWED_VIDEO:
            return jsonify({"error": f"File type .{ext} not allowed"}), 400
        
        file_type = "image" if ext in ALLOWED_IMAGE else "video"
        
        timestamp = int(os.path.getmtime(BASE_DIR))
        unique_filename = f"{timestamp}_{filename}"
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)
        
        file.save(filepath)
        
        return jsonify({
            "filepath": filepath,
            "filename": unique_filename,
            "type": file_type
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/process", methods=["POST"])
def process_media():
    data = request.get_json()
    filepath = data.get("filepath")
    text_labels = data.get("textLabels", [])
    bottom_text = data.get("bottomText", "")
    filename = data.get("filename", "output")
    format_type = data.get("format", "original")
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 400
    
    ext = filepath.rsplit(".", 1)[1].lower()
    output_filename = f"processed_{filename}"
    output_path = os.path.join(app.config["OUTPUT_FOLDER"], output_filename)
    
    if format_type != "original" and ext in ALLOWED_IMAGE:
        temp_path = os.path.join(app.config["UPLOAD_FOLDER"], f"temp_resize_{filename}")
        resize_for_instagram(filepath, temp_path, format_type)
        filepath = temp_path
    
    try:
        if ext in ALLOWED_IMAGE:
            apply_text_to_image(filepath, text_labels, bottom_text, output_path)
        elif ext in ALLOWED_VIDEO:
            apply_text_to_video(filepath, text_labels, output_path)
        
        return jsonify({
            "output": output_path,
            "filename": output_filename
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/download/<filename>")
def download(filename):
    return send_file(os.path.join(app.config["OUTPUT_FOLDER"], filename), as_attachment=True)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)