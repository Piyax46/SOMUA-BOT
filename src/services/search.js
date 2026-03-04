const axios = require('axios');
const Parser = require('rss-parser');

const parser = new Parser({
    customFields: {
        item: ['source', 'pubDate'],
    }
});

/**
 * Search the web using DuckDuckGo Html/Lite endpoint (Fast & Unblockable)
 * @param {string} query - Search query
 * @param {object} options - Additional options
 * @returns {Array} Search results
 */
async function searchGoogle(query, options = {}) {
    const items = [];
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=th-th`;

        try {
            // This time we use a GET request instead of POST with minimal headers.
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                }
            });

            // Use Cheerio to parse if duckduckgo html responded
            const cheerio = require('cheerio');
            const $ = cheerio.load(response.data);

            $('.result').each((i, el) => {
                const titleElement = $(el).find('.result__title .result__a');
                const snippetElement = $(el).find('.result__snippet');

                if (titleElement.length > 0) {
                    const title = titleElement.text().trim();
                    let link = titleElement.attr('href');
                    let snippet = snippetElement.text().trim() || 'ไม่มีคำอธิบาย';

                    if (link && link.startsWith('//duckduckgo.com/l/?uddg=')) {
                        link = decodeURIComponent(link.replace('//duckduckgo.com/l/?uddg=', ''));
                        link = link.split('&rut=')[0];
                    }

                    if (link && link.startsWith('http')) {
                        items.push({
                            title,
                            link: link.split('?')[0] + (link.split('?')[1] ? '?' + link.split('?')[1].replace(/&amp;/g, '&') : ''),
                            snippet,
                        });
                    }
                }
            });
        } catch (ddgError) {
            console.warn('DuckDuckGo blocked the request:', ddgError.message, 'Falling back to Wikipedia...');
        }

        // Wikipedia fallback if DDG returned 0 items or failed
        if (items.length === 0) {
            // Fallback to Wikipedia search API if DuckDuckGo blocks parsing
            const wikiUrl = `https://th.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
            const wikiRes = await axios.get(wikiUrl, {
                headers: {
                    'User-Agent': 'AnyBot/1.0 (https://discord.com; anybot@example.com) Axios/1.3'
                }
            });
            const wikiItems = wikiRes.data.query?.search || [];

            wikiItems.slice(0, options.num || 5).forEach(item => {
                items.push({
                    title: item.title + ' - Wikipedia',
                    link: `https://th.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
                    snippet: item.snippet.replace(/<[^>]*>?/gm, ''), // Remove HTML tags
                });
            });
        }

        return items.slice(0, options.num || 5);
    } catch (error) {
        console.error('Web Search Error (DDG/Wiki):', error.message);
        throw new Error('SEARCH_FAILED');
    }
}

/**
 * Search for recent news using Google News RSS (Extremely reliable)
 * @param {string} query - News topic
 * @returns {Array} News results
 */
async function searchNews(query) {
    try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=th&gl=TH&ceid=TH:th`;
        const feed = await parser.parseURL(url);

        const items = feed.items || [];

        return items.slice(0, 5).map(item => ({
            title: item.title,
            link: item.link,
            snippet: `${item.source || 'ข่าวล่าสุด'} • ${new Date(item.pubDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        }));
    } catch (error) {
        console.error('News RSS Error:', error.message);
        // Fallback to web search if RSS fails
        return searchGoogle(query + ' ข่าวล่าสุดอัพเดท', { num: 5 });
    }
}

module.exports = { searchGoogle, searchNews };
