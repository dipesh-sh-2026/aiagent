# Free AI APIs Setup Guide

## Quick Start
Your project is now configured to use multiple FREE AI providers. Choose one and add your API key to `.env`

## 🆓 Free AI Providers (Pick One or More)

### 1. **Groq** (Recommended - Most Generous Free Tier)
- **Free Tier**: 30,000 requests/day
- **Speed**: Extremely fast inference
- **Sign Up**: https://console.groq.com
- **Setup**:
  ```
  AI_PROVIDER=groq
  GROQ_API_KEY=your_key_here
  ```

### 2. **Google Gemini** (Google's AI)
- **Free Tier**: 60 requests/min, 1500 requests/day
- **Model**: Gemini 1.5 Flash (very capable)
- **Sign Up**: https://makersuite.google.com/app/apikey
- **Setup**:
  ```
  AI_PROVIDER=gemini
  GOOGLE_GEMINI_API_KEY=your_key_here
  ```

### 3. **OpenAI (ChatGPT)** (Paid but has free trial)
- **Free Trial**: $5 credit for 3 months
- **Sign Up**: https://platform.openai.com/account/api-keys
- **Setup**:
  ```
  AI_PROVIDER=openai
  OPENAI_API_KEY=your_key_here
  ```

### 4. **Mistral AI** (Open source focus)
- **Free Tier**: Available with limited requests
- **Sign Up**: https://console.mistral.ai/api-keys/
- **Setup**:
  ```
  AI_PROVIDER=mistral
  MISTRAL_API_KEY=your_key_here
  ```

### 5. **Together AI** (Open source models)
- **Free Tier**: $5 free credit
- **Sign Up**: https://www.together.ai/
- **Setup**:
  ```
  AI_PROVIDER=together
  TOGETHER_API_KEY=your_key_here
  ```

### 6. **Hugging Face** (Community models)
- **Free Tier**: Inference API available
- **Sign Up**: https://huggingface.co
- **Setup**:
  ```
  HUGGINGFACE_API_KEY=your_key_here
  ```

---

## 🚀 How to Use

### Step 1: Choose a Provider
Pick one from above (Groq recommended for best free tier)

### Step 2: Get API Key
Click the sign-up link and copy your API key

### Step 3: Update `.env`
Edit `c:\website\aiagent\.env`:
```env
AI_PROVIDER=groq
GROQ_API_KEY=your_actual_key_here
```

### Step 4: Restart Dev Server
```bash
npm run dev
```

The app will automatically use your chosen provider for:
- ✅ Research AI
- ✅ Image Generation  
- ✅ Video Creation

---

## 📊 Comparison Table

| Provider | Free Limit | Speed | Quality | Ease |
|----------|-----------|-------|---------|------|
| **Groq** | 30k/day | ⚡⚡⚡ Fastest | Great | Easy |
| **Gemini** | 1.5k/day | ⚡⚡ Fast | Excellent | Easy |
| **OpenAI** | $5 trial | ⚡ Standard | Excellent | Easy |
| **Mistral** | Limited | ⚡⚡ Fast | Very Good | Medium |
| **Together** | $5 credit | ⚡ Standard | Very Good | Medium |
| **HuggingFace** | Limited | Variable | Good | Hard |

---

## ⚠️ Important Notes

1. **API Keys are secret** - Never commit `.env` to git
2. **Free tiers have limits** - Groq has the most generous limits
3. **Multiple providers** - You can use different keys for different features
4. **Fallbacks** - If one provider fails, manually switch to another in `.env`

---

## 🔧 Current Configuration

Your `.env` file now supports all 6 providers. Just uncomment and fill in your key!

**Active Provider**: Check `AI_PROVIDER` in `.env`

---

## ❓ Questions?

- Groq Docs: https://console.groq.com/docs
- Gemini Docs: https://ai.google.dev
- OpenAI Docs: https://platform.openai.com/docs
