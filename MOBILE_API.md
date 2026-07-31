# 📱 Mobile API & Git Setup Guide

This guide explains how to run this project on mobile devices (Android / iOS) via **Git**, expose the backend API, and consume the AI API endpoints from mobile apps (React Native, Flutter, Swift, Android/Kotlin, PWA, or Postman).

---

## 🚀 Quick Setup via Git

### 1. Push Repository to GitHub / GitLab
To run or deploy this API anywhere (including mobile environments or cloud servers):

```bash
# Add your remote git repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### 2. Running on Mobile via Termux (Android)
You can clone and run the full server natively on Android using [Termux](https://termux.dev):

```bash
# 1. Install Node.js & Git in Termux
pkg update && pkg install nodejs git

# 2. Clone your Git repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME

# 3. Create .env with your AI API keys
cp .env.example .env

# 4. Install dependencies and start server in host mode
npm install
npm run dev:host
```

---

## 🌐 Connecting Mobile Devices to Local Server

When running `npm run dev:host`, the server listens on `0.0.0.0` (all network interfaces).

- **Local Wi-Fi Access**: Open `http://<YOUR_COMPUTER_IP>:3000` in your mobile browser.
- **API Base URL**: `http://<YOUR_COMPUTER_IP>:3000/api`

---

## 📡 API Endpoints Reference

All API routes support **CORS** (`Access-Control-Allow-Origin: *`) for seamless mobile integration.

### 1. Website Generator API
- **Endpoint**: `POST /api/website`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "messages": [
      { "role": "user", "content": "Create a modern landing page for a coffee shop" }
    ]
  }
  ```
- **Response**: SSE stream containing generated HTML/CSS code.

---

### 2. Deep Research API
- **Endpoint**: `POST /api/research`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "messages": [
      { "role": "user", "content": "What are the latest developments in quantum computing?" }
    ]
  }
  ```
- **Response**: SSE stream containing live web research results.

---

### 3. Code Research & Assistant API
- **Endpoint**: `POST /api/code-research`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "messages": [
      { "role": "user", "content": "How do I implement JWT authentication in Node.js?" }
    ]
  }
  ```
- **Response**: SSE stream containing senior engineer code review & suggestions.

---

### 4. Image Generation API
- **Endpoint**: `POST /api/generate-image`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "prompt": "Cyberpunk neon city skyline at night",
    "size": "1024x1024",
    "style": "photorealistic"
  }
  ```
- **Response**: SSE stream emitting base64-encoded image data:
  ```json
  event: image_generation.completed
  data: {"b64_json":"...","content_type":"image/jpeg","status":"completed"}
  ```

---

## 📲 Calling the API from Mobile (Examples)

### JavaScript / React Native / Fetch
```javascript
async function generateImage(prompt) {
  const response = await fetch('http://<YOUR_SERVER_IP>:3000/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, style: 'photorealistic' })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value);
  }
  console.log('API Response:', result);
}
```

### Flutter / Dart
```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<void> fetchAiResearch(String prompt) async {
  final url = Uri.parse('http://<YOUR_SERVER_IP>:3000/api/research');
  final response = await http.post(
    url,
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'messages': [{'role': 'user', 'content': prompt}]
    }),
  );

  print('Response status: ${response.statusCode}');
  print('Response body: ${response.body}');
}
```

---

## 🛠 Cloud Deployment for Mobile Access

To access the API from anywhere without local Wi-Fi:
1. Push your repository to **GitHub**.
2. Connect your repo to **Vercel**, **Render**, **Railway**, or **Cloudflare Pages**.
3. Add environment variables (`GROQ_API_KEY`, `GOOGLE_GEMINI_API_KEY`, etc.) in the host dashboard.
4. Your API will be live at `https://your-app.vercel.app/api/...` with mobile CORS support built in!
