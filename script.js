// *** IMPORTANT: CONFIGURE YOUR BACKEND_BASE_URL ***
// Choose ONE of the following lines based on how you are accessing the frontend:

// Option 1: If accessing frontend from browser on SAME COMPUTER (e.g., via http://localhost:8000 or http://127.0.0.1:5500):
const BACKEND_BASE_URL = 'http://localhost:3001';

// Option 2: If accessing frontend from a MOBILE DEVICE on the SAME NETWORK (e.g., via http://192.168.29.41:8000):
//    You MUST use your computer's actual local IP address for the backend as well:
// const BACKEND_BASE_URL = 'http://192.168.29.41:3001'; // <-- UNCOMMENT THIS LINE AND REPLACE WITH YOUR COMPUTER'S IP
//                                                       // AND COMMENT OUT THE LINE ABOVE


// DOM Elements for Main Feed
const mainAppContainer = document.querySelector('.main-app-container');
const newsFeedContainer = document.getElementById('newsFeedContainer');
const loadingIndicator = document.getElementById('loadingIndicator');

// DOM Elements for Article Detail View
const articleDetailOverlay = document.getElementById('articleDetailOverlay');
const closeArticleDetailBtn = document.getElementById('closeArticleDetailBtn');
const detailArticleImage = document.getElementById('detailArticleImage');
const detailImageAttribution = document.getElementById('detailImageAttribution');
const detailArticleTitle = document.getElementById('detailArticleTitle');
const detailArticleSource = document.getElementById('detailArticleSource');
const detailArticleBody = document.getElementById('detailArticleBody');
const detailReadMoreLink = document.getElementById('detailReadMoreLink');

const defaultTopic = 'breaking-news'; // GNews API uses 'topic'

let currentPage = 1;
const articlesPerPage = 10;
let isLoading = false;
let totalResults = 0;

// Function to fetch headlines (now via your backend proxy)
async function fetchNews(topic, page) {
    if (isLoading) return { articles: [], totalArticles: 0 };
    isLoading = true;
    loadingIndicator.style.display = 'flex'; // Show spinner

    // Call your backend's headlines endpoint
    const url = `${BACKEND_BASE_URL}/api/headlines?topic=${topic}&page=${page}&max=${articlesPerPage}`;
    console.log(`Frontend: Fetching headlines via proxy URL: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Frontend: Proxy Headlines Error Response:', response.status, response.statusText, errorData);
            alert(`Error from Proxy (Headlines): ${errorData.error || response.statusText}. Status: ${response.status}`);
            return { articles: [], totalArticles: 0 };
        }
        const data = await response.json();
        totalResults = data.totalArticles;
        console.log("Frontend: Headlines Data received from proxy:", data);
        return data;
    } catch (error) {
        console.error('Frontend: Network or other error during proxy headlines fetch:', error);
        alert('Could not fetch headlines from proxy. Check if backend server is running and reachable.');
        return { articles: [], totalArticles: 0 };
    } finally {
        isLoading = false;
        loadingIndicator.style.display = 'none'; // Hide spinner
    }
}

// Function to create and append a news card
function createNewsCard(article) {
    if (!article.title || !article.url || !article.image) return null;

    const newsCard = document.createElement('div');
    newsCard.classList.add('news-card');
    newsCard.classList.add('animate-in');

    newsCard.addEventListener('click', () => {
        showArticleDetail(article);
    });

    const imageUrl = isValidUrl(article.image)
        ? article.image
        : 'https://via.placeholder.com/600x300?text=No+Image+Available';

    newsCard.innerHTML = `
        <img src="${imageUrl}" alt="${article.title}" class="news-card-image" onerror="this.onerror=null;this.src='https://via.placeholder.com/600x300?text=Image+Load+Failed';">
        <div class="news-card-content">
            <div class="news-card-source">${article.source.name || 'Unknown Source'}</div>
            <h2 class="news-card-title">${article.title}</h2>
            <p class="news-card-description">${article.description || ''}</p>
        </div>
    `;
    return newsCard;
}

// Helper to validate URL
function isValidUrl(string) {
    try {
        new URL(string);
        return /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(string.split('?')[0]);
    } catch (e) {
        return false;
    }
}

// Function to load and display news
async function loadNews(append = false) {
    if (!append) {
        newsFeedContainer.innerHTML = '';
        newsFeedContainer.appendChild(loadingIndicator);
        currentPage = 1;
        newsFeedContainer.scrollTop = 0;
    }

    const data = await fetchNews(defaultTopic, currentPage);
    if (data && data.articles && data.articles.length > 0) {
        data.articles.forEach((article, index) => {
            const card = createNewsCard(article);
            if (card) {
                card.style.animationDelay = `${index * 0.05}s`;
                newsFeedContainer.appendChild(card);
            }
        });
    } else {
        if (!append) {
            newsFeedContainer.innerHTML = '<p style="text-align: center; color: var(--secondary-text); padding: 40px;">No news found from proxy. Check your backend console for errors.</p>';
        } else {
            loadingIndicator.style.display = 'none';
        }
    }
    if (!isLoading) {
        loadingIndicator.style.display = 'none';
    }
}

// Infinite scrolling logic
newsFeedContainer.addEventListener('scroll', () => {
    const atBottom = newsFeedContainer.scrollTop + newsFeedContainer.clientHeight >= newsFeedContainer.scrollHeight - 1;

    if (atBottom && !isLoading && (currentPage * articlesPerPage < totalResults)) {
        currentPage++;
        loadNews(true);
    }
});

// --- Article Detail View Logic ---

async function showArticleDetail(article) {
    // Show loading spinner for article content
    detailArticleBody.innerHTML = '<div class="loading-indicator" style="display:flex;"> <div class="spinner"></div> <span>Generating article...</span></div>';
    
    // Populate with initial data from the card
    detailArticleImage.src = isValidUrl(article.image) ? article.image : 'https://via.placeholder.com/800x450?text=Image+Not+Available';
    detailArticleImage.onerror = () => { detailArticleImage.src = 'https://via.placeholder.com/800x450?text=Image+Load+Failed'; };
    
    detailImageAttribution.textContent = article.source.name ? `${article.source.name} / Original Source` : ''; 
    detailArticleTitle.textContent = article.title;
    detailArticleSource.textContent = article.source.name || 'Unknown Source';
    detailReadMoreLink.href = article.url; // Link to original article remains important

    // Show the detail overlay
    articleDetailOverlay.classList.add('active');
    mainAppContainer.style.opacity = '0';
    mainAppContainer.style.visibility = 'hidden';
    document.querySelector('.article-detail-content-wrapper').scrollTop = 0;

    // --- Fetch AI-generated content from your backend proxy ---
    try {
        const generateResponse = await fetch(`${BACKEND_BASE_URL}/api/generate-article?title=${encodeURIComponent(article.title)}&description=${encodeURIComponent(article.description || '')}&sourceName=${encodeURIComponent(article.source.name || '')}`);
        
        if (!generateResponse.ok) {
            const errorData = await generateResponse.json();
            console.error('Frontend: Proxy Generate Article Error:', generateResponse.status, generateResponse.statusText, errorData);
            detailArticleBody.innerHTML = `<p style="color:var(--secondary-text); text-align:center;">Failed to generate article: ${errorData.error || 'Unknown error'}.</p>`;
            // Fallback to GNews description if AI generation fails
            if (article.content || article.description) {
                detailArticleBody.innerHTML += `<p>${article.content || article.description}</p><p style="font-size:0.9em;color:var(--source-color);">(Displayed initial description as fallback)</p>`;
            }
            return;
        }
        const generatedData = await generateResponse.json();
        
        // Display AI-generated content
        detailArticleBody.innerHTML = `<p>${generatedData.generatedContent || 'AI could not generate content.'}</p>`;


    } catch (error) {
        console.error('Frontend: Network error or backend not reachable for AI generation:', error);
        detailArticleBody.innerHTML = '<p style="color:var(--secondary-text); text-align:center;">Network error or backend not reachable for AI generation.</p>';
        // Fallback to GNews description
        if (article.content || article.description) {
            detailArticleBody.innerHTML += `<p>${article.content || article.description}</p><p style="font-size:0.9em;color:var(--source-color);">(Displayed initial description as fallback)</p>`;
        }
    }
}

function hideArticleDetail() {
    articleDetailOverlay.classList.remove('active');
    mainAppContainer.style.opacity = '1';
    mainAppContainer.style.visibility = 'visible';
    // Clear content when hidden to prepare for next article
    detailArticleImage.src = '';
    detailImageAttribution.textContent = '';
    detailArticleTitle.textContent = '';
    detailArticleSource.textContent = '';
    detailArticleBody.innerHTML = ''; // Clear generated content
    detailReadMoreLink.href = '#';
}

closeArticleDetailBtn.addEventListener('click', hideArticleDetail);


// Initial load of news when the page loads
document.addEventListener('DOMContentLoaded', () => {
    loadNews();
});