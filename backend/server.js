const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const cheerio = require('cheerio'); // Still included for potential scraping (not used by default with AI generation)

// Import Google Generative AI library
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai');

const app = express();
const PORT = 3001; // Your backend will run on port 3001

// *** IMPORTANT: CONFIGURE YOUR FRONTEND ORIGIN FOR CORS ***
// This tells your backend which frontend URLs are allowed to connect to it.
// Replace 'http://192.168.29.41:8000' with your actual computer's IP and port for your frontend.
// If you use VS Code Live Server, it might be 'http://127.0.0.1:5500'.
// You can add multiple origins to the array if you test from different local URLs.
const FRONTEND_ORIGIN = ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://127.0.0.1:5500', 'http://192.168.29.41:8000']; // EXAMPLE - ADJUST AS NEEDED!

app.use(cors({ origin: FRONTEND_ORIGIN }));


// API Key for GNews (used here on the backend to proxy GNews headlines)
const GNEWS_API_KEY = 'd369482f1c5183e45d08fd1e73bbb60d';
const GNEWS_BASE_URL = 'https://gnews.io/api/v4/top-headlines';

// *** Your Google API Key for Gemini Pro ***
// IMPORTANT: Keep this server-side. DO NOT expose it in frontend code.
const GEMINI_API_KEY = 'AIzaSyA0SRTKK-PcppC7u8B7VUKlqOnjY21bxQE';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Updated model to 'gemini-2.0-flash'
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


// Endpoint to get latest headlines (proxies GNews API)
app.get('/api/headlines', async (req, res) => {
    const { topic = 'breaking-news', page = 1, max = 10 } = req.query;
    const url = `${GNEWS_BASE_URL}?topic=${topic}&lang=en&max=${max}&page=${page}&token=${GNEWS_API_KEY}`;

    try {
        const apiResponse = await fetch(url);
        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        console.error('Backend: Error fetching from GNews:', error);
        res.status(500).json({ error: 'Failed to fetch news from GNews API' });
    }
});

// Endpoint to Generate Article Content using Gemini Pro
app.get('/api/generate-article', async (req, res) => {
    const { title, description, sourceName } = req.query;

    if (!title) {
        return res.status(400).json({ error: 'Title is required to generate article content.' });
    }

    // Construct a detailed prompt for Gemini Pro
    const prompt = `Based on the following news headline and brief description, generate a concise yet comprehensive news article (around 200-300 words) that provides context, key details, and potential implications. Focus on factual reporting. Do not include a conversational intro like "Here's an article..." or "This article details...". Just provide the news content.

    Headline: "${title}"
    Description: "${description || 'No specific description provided, infer from headline.'}"
    Source (for context, if available): ${sourceName || 'Unknown'}

    Generated Article:
    `;

    console.log("Backend: Generating content with Gemini Pro for:", title);

    try {
        const result = await geminiModel.generateContent({
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
        });
        const response = await result.response;
        const generatedText = response.text();

        console.log("Backend: Gemini Pro generated content for:", title.substring(0, 50) + "...");
        res.json({ generatedContent: generatedText });

    } catch (error) {
        console.error('Backend: Error calling Gemini Pro API:', error.message);
        res.status(500).json({ error: 'Failed to generate article content with AI.', details: error.message });
    }
});

// *** UPDATED ENDPOINT: Handle Follow-up Questions with Gemini Pro (Web-enabled) ***
app.get('/api/ask-gemini', async (req, res) => {
    const { question, context } = req.query; // Context is still passed, but prompt won't strictly use it

    if (!question) {
        return res.status(400).json({ error: 'Question is required.' });
    }

    console.log("Backend: Answering question with Gemini Pro (web-enabled):", question.substring(0, 50) + "...");

    // Prompt now encourages using general knowledge, not just the provided article context.
    // The 'context' parameter from frontend is still passed but used as general background rather than strict constraint.
    const prompt = `Answer the following question. Use your general knowledge to provide a comprehensive and helpful response. If the question is ambiguous, provide a balanced answer.

    Question: "${question}"

    (Context related to the current news article, if helpful: ${context.substring(0, 500)}...)

    Answer:
    `;

    try {
        const result = await geminiModel.generateContent({
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
        });
        const response = await result.response;
        const answerText = response.text();

        console.log("Backend: Gemini Pro answered:", answerText.substring(0, 50) + "...");
        res.json({ answer: answerText });

    } catch (error) {
        console.error('Backend: Error calling Gemini Pro for Q&A:', error.message);
        res.status(500).json({ error: 'Failed to get AI answer.', details: error.message });
    }
});


// Endpoint to scrape full article content (kept as a separate option, not used by default in frontend)
app.get('/api/scrape-article', async (req, res) => {
    const articleUrl = req.query.url;

    if (!articleUrl) {
        return res.status(400).json({ error: 'Article URL is required' });
    }

    console.log(`Backend: Attempting to scrape: ${articleUrl}`);

    try {
        const response = await fetch(articleUrl, { timeout: 10000 }); // 10 second timeout
        if (!response.ok) {
            console.error(`Backend: Failed to fetch article: ${response.status} ${response.statusText}`);
            return res.status(response.status).json({ error: `Failed to fetch article from source: ${response.statusText}` });
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        let mainContent = '';
        const possibleSelectors = [
            'article', 'div.entry-content', 'div.article-body', 'div.post-content',
            'div[itemprop="articleBody"]', 'div.story-content', 'div.main-content', 'div.content-main'
        ];

        for (const selector of possibleSelectors) {
            const element = $(selector);
            if (element.length) {
                mainContent = element.first().text().trim();
                break;
            }
        }
        
        if (!mainContent) {
            mainContent = $('body').text().substring(0, 1000) + '... (Could not find specific article content)';
        }
        mainContent = mainContent.replace(/\s\s+/g, ' ').replace(/\n\n+/g, '\n\n');


        let imageUrl = $('meta[property="og:image"]').attr('content') ||
                       $('meta[name="twitter:image"]').attr('content') ||
                       $('img[itemprop="image"]').attr('src');
        
        if (imageUrl && !imageUrl.startsWith('http')) {
            try {
                imageUrl = new URL(imageUrl, articleUrl).href;
            } catch (e) {
                imageUrl = null;
            }
        }

        let title = $('meta[property="og:title"]').attr('content') ||
                    $('h1').first().text().trim() ||
                    $('title').text().trim();

        res.json({
            fullContent: mainContent,
            fullTitle: title,
            fullImageUrl: imageUrl
        });

    } catch (error) {
        console.error('Backend: Error during scraping:', error);
        res.status(500).json({ error: 'Failed to scrape article content', details: error.message });
    }
});


app.listen(PORT, () => {
    console.log(`Backend proxy server running on http://localhost:${PORT}`);
    console.log(`Frontend should connect to: ${Array.isArray(FRONTEND_ORIGIN) ? FRONTEND_ORIGIN.join(' or ') : FRONTEND_ORIGIN}`);
    console.log(`For AI-generated content, frontend will hit: http://localhost:${PORT}/api/generate-article`);
    console.log(`For scraped content (if you enable it in frontend): http://localhost:${PORT}/api/scrape-article`);
});