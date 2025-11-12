📚 Jarvis – School Chatbot for GGPS Sector 5

Jarvis is an AI-powered school assistant designed for Guru Gobind Singh Public School, Sector 5. It helps students and visitors interact with school information, subject knowledge (classes 8–12), and policies through a friendly web-based chatbot interface. It supports voice input and output, quick replies, and AI-enhanced responses.

---

🚀 Features

- 🧠 AI-powered responses using a cloud-based text generation API
- 📚 Subject-aware Q&A for Physics, Chemistry, Biology, Math, English, CS/IP/AI/PE
- 🏫 School-specific facts: timings, admission, attendance, teachers
- 🎤 Voice input (Web Speech API) and 🔊 voice output (Text-to-Speech)
- 💬 Responsive chat UI with quick-reply chips and typing indicators
- 📝 Easy-to-edit local Q&A file for teachers to update answers

---

🛠️ Tech Stack

- Python 3.8+
- Flask (backend)
- HTML/CSS/JavaScript (frontend)
- ChatterBot (optional fallback)
- AI API (OpenAI or compatible)
- Web Speech API (browser voice input)
- SpeechSynthesis (browser voice output)

---

📁 Project Structure

`
jarvis/
├── app.py                  # Flask backend
├── data/
│   └── school_data.txt     # Local Q&A for school facts
├── models/                 # Optional model storage
├── templates/
│   └── index.html          # Chat UI
├── static/
│   ├── style.css           # Styling
│   ├── script.js           # Chat logic + voice
│   └── jarvis_logo.png     # Logo image
└── README.md               # This file
`

---

⚙️ Setup Instructions

1. Install dependencies
   `bash
   pip install flask requests flask_cors
   `

2. Set environment variables
   `bash
   export AIAPIURL="https://your-ai-provider.com/api"
   export AIAPIKEY="your-api-key"
   `

3. Run the app
   `bash
   python app.py
   `

4. Open in browser
   `
   http://127.0.0.1:5000
   `
5. In cmd run this code
   pip install python-dotenv

6. In .env file chenge the ai api key and ai api url with your ai api key and url
example - export AI_API_URL="https://api.openai.com/v1/chat/completions"
export AI_API_KEY="your-secret-key-here"
---

🧠 Training Jarvis with School Knowledge

Add Q&A pairs to data/school_data.txt like this:

`
What are the school hours?
School hours are 08:30 to 14:00 Monday to Friday.

What is Ohm's law?
Ohm's law states that current is directly proportional to voltage across a conductor.
`

Jarvis will match exact questions and reply instantly. For other queries, it uses the AI backend.

---

🎨 Customization

- Change school name in app.py and index.html
- Add teacher photos or subject icons in static/
- Modify quick-reply chips in index.html
- Add admin panel for editing Q&A (optional)

---

🧪 Testing

- Try typing or speaking:
  - “What is photosynthesis?”
  - “Who is the class teacher for 10A?”
  - “How to apply for admission?”

Jarvis will reply with voice and text.

---

📌 Notes

- Works best in Chrome (for voice input/output)
- AI backend must support prompt-based text generation
- Local Q&A overrides AI for school-specific facts

---

👩‍🏫 Contributors

- Abhi – Developer & Designer
- Copilot - Thinker & Director
- GGPS Sector 5 – School context and data

---