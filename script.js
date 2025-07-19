const API_KEY = '406748dc4bf8411e885fc5feb0f6a1ed'; // Your NewsAPI.org key
const NEWS_API_BASE_URL = 'https://newsapi.org/v2/top-headlines';

const newsFeedContainer = document.getElementById('newsFeedContainer');
const loadingIndicator = document.getElementById('loadingIndicator');

const defaultCategory = 'general'; // Fixed category for the single feed

let currentPage = 1;
const articlesPerPage = 10;
let isLoading = false;
let totalResults = 0;

// Function to fetch news
async function fetchNews(category, page) {
    if (isLoading) return { articles: [], totalResults: 0 };
    isLoading = true;
    loadingIndicator.style.display = 'flex'; // Use flex to show spinner and text

    const url = `${NEWS_API_BASE_URL}?category=${category}&pageSize=${articlesPerPage}&page=${page}&apiKey=${API_KEY}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 426) {
                alert('NewsAPI: Upgrade Required. You might have hit a free tier limit for this type of query.');
            } else if (response.status === 429) {
                alert('You have made too many requests to NewsAPI. Please wait a bit or consider upgrading your plan.');
            } else {
                alert(`Error fetching news: ${response.statusText}. Status: ${response.status}`);
            }
            console.error('API Error:', response.status, response.statusText, await response.text());
            return { articles: [], totalResults: 0 };
        }
        const data = await response.json();
        totalResults = data.totalResults;
        return data;
    } catch (error) {
        console.error('Network or other error:', error);
        alert('Could not fetch news. Please check your internet connection or a browser security setting.');
        return { articles: [], totalResults: 0 };
    } finally {
        isLoading = false;
        loadingIndicator.style.display = 'none'; // Hide when done
    }
}

// Function to create and append a news card
function createNewsCard(article) {
    if (!article.title || !article.url) return null;

    const newsCard = document.createElement('div');
    newsCard.classList.add('news-card');
    // Add animate-in class to trigger CSS animation
    newsCard.classList.add('animate-in'); // This line is new!

    newsCard.addEventListener('click', () => {
        window.open(article.url, '_blank');
    });

    const imageUrl = article.urlToImage && isValidUrl(article.urlToImage)
        ? article.urlToImage
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

    const data = await fetchNews(defaultCategory, currentPage);
    if (data && data.articles && data.articles.length > 0) {
        data.articles.forEach((article, index) => {
            const card = createNewsCard(article);
            if (card) {
                // Stagger animation slightly for a smoother flow
                card.style.animationDelay = `${index * 0.05}s`;
                newsFeedContainer.appendChild(card);
            }
        });
    } else {
        if (!append) {
            newsFeedContainer.innerHTML = '<p style="text-align: center; color: var(--secondary-text); padding: 40px;">No news found for this category (or global headlines).</p>';
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

// Initial load of news when the page loads
document.addEventListener('DOMContentLoaded', () => {
    loadNews();
});