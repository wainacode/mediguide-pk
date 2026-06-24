# MediGuide Pakistan (میڈی گائیڈ پاکستان) 🇵🇰
### A Premium Web-Based AI Medication Guidance Web App for Pakistani Patients and Caregivers

**MediGuide Pakistan** is an empathetic, friendly, and easy-to-understand web-based AI assistant designed specifically for patients, caregivers, and families in Pakistan. It is built using a secure **Node.js & Express.js** backend, the official **Google Gen AI SDK**, and a gorgeous mobile-first **Glassmorphism** frontend.

This application is ready to run on your local computer or deploy to the internet for free on **Vercel** for your Kaggle Capstone Project.

---

## 🌟 Key Features

1. **Bilingual Support (English & Urdu):** Understands and responds in the language you use (Urdu Script, English, Roman Urdu, or mixed "Urdish").
2. **Urdu Text Optimization:** Automatically detects Urdu script and formats the text Right-to-Left (RTL) with beautiful spacing and fonts (Noto Nastaliq Urdu) so it is clear and readable.
3. **Pakistani Brand Recognition:** Maps local brand names (like *Panadol, Calpol, Brufen, Ponstan, Flagyl, Augmentin, Risek, Arinac, Surbex-Z*) to their active generic ingredients and functions.
4. **Premium UI/UX Aesthetics:** Features a dark-teal-to-cyan gradient background with subtle medical cross patterns, animated floating medical particles (pills and crosses), a heartbeat ECG line animation, and frosted glass (glassmorphism) layouts.
5. **Automatic Retry Mechanism:** If the Google Gemini API has a temporary connection hiccup, the server automatically retries 3 times (with a 1.5-second delay) before returning an error, making the app highly reliable.
6. **Safety & Compliance:** Features a prominent Rescue 1122 emergency banner and an educational medical disclaimer in the footer.
7. **Secure Key Management:** All API requests are routed through a secure Express.js server, meaning your private Google Gemini API key is never exposed to the web browser.

---

## 🛠️ Step 1: Getting Ready (Prerequisites)

Before running the application, make sure you have:
1. **Node.js** (Version 18 or higher) installed on your computer. Download the **LTS (Recommended)** version from [nodejs.org](https://nodejs.org/).
2. **Google Gemini API Key**: You can get a free API key from [Google AI Studio](https://aistudio.google.com/). Write this key down in a safe place.

---

## 🚀 Step 2: How to Run the App Locally (On Your Computer)

Follow these steps to run the application on your local machine:

### 1. Open Terminal or PowerShell
Navigate to the directory where your project files are located.
* **On Windows (PowerShell):**
  1. Open the Start menu, type `PowerShell`, and press Enter.
  2. Navigate to your project folder:
     ```powershell
     cd d:\MediGuide-pk
     ```

### 2. Install Project Dependencies
Run this command to download and install the required code packages (like Express and Google Gen AI client):
```bash
npm install
```

### 3. Configure Your Secret API Key
To protect your API key, you store it in a local configuration file named `.env`. This file is hidden and will not be shared publicly.
1. Duplicate the `.env.example` template into a new file called `.env`:
   * **PowerShell (Windows):**
     ```powershell
     Copy-Item .env.example .env
     ```
   * **Command Prompt (Windows):**
     ```cmd
     copy .env.example .env
     ```
2. Open the new `.env` file in any text editor (like Notepad).
3. Replace the placeholder text with your actual Gemini API key:
   ```env
   GEMINI_API_KEY=AIzaSyYourActualKeyHere
   PORT=3000
   ```
4. Save and close the file.

### 4. Run the Server
Start the Express server by typing:
```bash
npm start
```
You will see output stating:
`🚀 MediGuide Pakistan Web App is running!`
`🌐 Local URL: http://localhost:3000`

### 5. Open in Web Browser
Open your browser (Chrome, Edge, Safari) and go to `http://localhost:3000`. You can now chat with MediGuide Pakistan! To stop the local server at any time, press `Ctrl + C` in your terminal window.

---

## 🌍 Step 3: How to Deploy on Vercel for Free (Public Web Link)

Vercel is a hosting platform that lets you publish websites for free. Because we created a `vercel.json` file, Vercel will configure our Express serverless functions automatically!

### 1. Upload Your Code to GitHub
Vercel deploys websites directly from a GitHub repository.
1. Create a free account on [GitHub](https://github.com/).
2. Click **New** to create a new repository. Name it `mediguide-pakistan` and keep it public. Do **not** check "Add a README" or "Add .gitignore" since we already have them.
3. Open your terminal in `d:\MediGuide-pk` and run these Git commands to upload your files:
   ```bash
   # 1. Initialize a Git repository in this folder
   git init

   # 2. Add all files to the upload list
   git add .

   # 3. Save these files with a commit message
   git commit -m "Initial commit of MediGuide Pakistan"

   # 4. Rename the default upload branch to main
   git branch -M main

   # 5. Connect your local folder to your GitHub repository
   # (Replace with your actual GitHub username)
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/mediguide-pakistan.git

   # 6. Upload the files to GitHub
   git push -u origin main
   ```
   *(Note: The `.gitignore` file automatically blocks the `.env` file from uploading. This ensures your private Gemini API key is never exposed on GitHub).*

### 2. Connect GitHub to Vercel
1. Go to [Vercel](https://vercel.com/) and sign up using your **GitHub account**.
2. On your Vercel Dashboard, click the **Add New...** button and select **Project**.
3. You will see a list of your GitHub repositories. Find `mediguide-pakistan` and click **Import**.

### 3. Add Environment Variables on Vercel (Critical Step)
Before clicking Deploy, you must tell Vercel what your Gemini API key is.
1. On the configuration page, scroll down to the **Environment Variables** section.
2. In the **Key** field, type:
   `GEMINI_API_KEY`
3. In the **Value** field, paste your actual Google Gemini API key (starting with `AIzaSy...`).
4. Click the **Add** button.

### 4. Deploy!
1. Click **Deploy**. Vercel will build and launch your application.
2. After about 1–2 minutes, Vercel will show a "Congratulations!" screen and provide a public URL (e.g. `https://mediguide-pakistan.vercel.app`).
3. Copy this link. You can open it on your phone, share it with patients, or include it in your Capstone Project submission!

---

## 🧪 Step 4: How to Test Your Application

1. **Verify Responsive Layout (Mobile Emulation):**
   * On your computer in Google Chrome, right-click anywhere and choose **Inspect** (or press `F12`).
   * Click the **Toggle Device Toolbar** icon (looks like a phone/tablet) at the top-left of the inspect pane.
   * Change the device size (e.g. iPhone SE, Pixel 5) and verify that the chat layout fits nicely, the input box stays stuck to the bottom, and the emergency banner wraps correctly.
2. **Verify Language & Brand mapping:**
   * **In English:** Ask `"Can you explain the side effects of Augmentin?"`. Verify it lists side effects in simple terms and names the active generics (Co-amoxiclav).
   * **In Roman Urdu:** Ask `"Flagyl kab leni chahiye?"`. Verify it replies in Roman Urdu starting with `"Assalam-o-Alaikum"`.
   * **In Urdu Script:** Ask `"کیا میں ہائی بلڈ پریشر میں لوپرین لے سکتا ہوں؟"`. Verify that the text renders from right to left (RTL) with beautiful Noto Nastaliq script spacing.
3. **Verify API Retries & Graceful Failure:**
   * Revoke your internet connection or stop the local server and try to send a message. Verify that the UI displays a clean red network connection error bubble rather than freezing or crashing.

---

## 🔍 Common Errors & How to Fix Them

### 1. `❌ Error: GEMINI_API_KEY is not configured in .env file!`
* **Why it happens:** The server launched locally but could not read your API key.
* **How to fix:**
  * Make sure your environment file is named exactly `.env` (it must not be `.env.txt` or `.env.example`).
  * Verify the key is written as `GEMINI_API_KEY=your_key` (no spaces around the `=` sign).

### 2. Vercel deployment gives a "404 Not Found" or "Server Error" on chats
* **Why it happens:** The API key was not entered or was spelled incorrectly in Vercel settings.
* **How to fix:**
  * Go to your Vercel Dashboard, select your project, go to **Settings** > **Environment Variables**.
  * Make sure the key name is exactly `GEMINI_API_KEY`.
  * If you updated it, go to the **Deployments** tab, click the three dots on the latest deployment, and choose **Redeploy** to apply the new environment variables.

### 3. Vercel deployment fails to build
* **Why it happens:** Vercel couldn't locate `package.json` or `server.js` in the root folder.
* **How to fix:**
  * Ensure `vercel.json` is located in the main project folder next to `server.js` (not inside `public`).

---

## 📋 Kaggle Capstone Project Submission Checklist
- [ ] Local server ran successfully on `http://localhost:3000`.
- [ ] Code was pushed to GitHub (excluding the `.env` secret file).
- [ ] Deployed live on Vercel with `GEMINI_API_KEY` configured in Vercel project settings.
- [ ] Tested sending chats in English, Roman Urdu, and Urdu script.
- [ ] Verified that the 1122 Emergency Banner and Medical Disclaimer appear prominently on both desktop and mobile screens.
- [ ] Verified that the app has a premium, modern teal/cyan glassmorphic style.
- [ ] Copied the Vercel URL and added it to your final Kaggle Capstone submission document.
