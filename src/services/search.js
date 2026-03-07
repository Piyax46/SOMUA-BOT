const axios = require('axios');

const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_SEARCH_CX;

/**
 * Search the web — Strategy:
 *   1. DuckDuckGo HTML (free, unlimited)
 *   2. Google Custom Search API (fallback — 100/day free)
 *   3. Wikipedia (last resort)
 */
async function searchGoogle(query, options = {}) {
    const num = options.num || 5;

    // === Attempt 1: DuckDuckGo HTML (unlimited, no API key) ===
    const ddgResults = await searchDuckDuckGo(query, num);
    if (ddgResults.length > 0) return ddgResults;

    // === Attempt 2: Google Custom Search API (100/day free) ===
    if (GOOGLE_API_KEY && GOOGLE_CX) {
        try {
            console.log('[Search] DDG returned 0 results, trying Google API...');
            const url = 'https://www.googleapis.com/customsearch/v1';
            const response = await axios.get(url, {
                params: {
                    key: GOOGLE_API_KEY,
                    cx: GOOGLE_CX,
                    q: query,
                    num: num,
                    hl: 'th',
                    gl: 'th',
                },
                timeout: 10000,
            });

            const items = (response.data.items || []).map(item => ({
                title: item.title,
                link: item.link,
                snippet: item.snippet || 'ไม่มีคำอธิบาย',
            }));

            if (items.length > 0) return items;
        } catch (err) {
            console.warn('[Search] Google API failed:', err.response?.status, err.message);
        }
    }

    // === Attempt 3: Wikipedia (always works) ===
    return await searchWikipedia(query, num);
}

/**
 * DuckDuckGo HTML scraping (free, unlimited)
 */
async function searchDuckDuckGo(query, num = 5) {
    const items = [];
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=th-th`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 10000,
        });

        const cheerio = require('cheerio');
        const $ = cheerio.load(response.data);

        $('.result').each((i, el) => {
            if (items.length >= num) return false;
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
                    items.push({ title, link, snippet });
                }
            }
        });
    } catch (err) {
        console.warn('[Search] DuckDuckGo failed:', err.message);
    }
    return items;
}

/**
 * Wikipedia search API (always free, always works)
 */
async function searchWikipedia(query, num = 5) {
    const items = [];
    try {
        const wikiUrl = `https://th.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
        const wikiRes = await axios.get(wikiUrl, {
            headers: { 'User-Agent': 'SomuaBot/1.0' },
            timeout: 10000,
        });
        const wikiItems = wikiRes.data.query?.search || [];
        wikiItems.slice(0, num).forEach(item => {
            items.push({
                title: item.title + ' - Wikipedia',
                link: `https://th.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
                snippet: item.snippet.replace(/<[^>]*>?/gm, ''),
            });
        });
    } catch (e) {
        console.warn('[Search] Wikipedia fallback also failed:', e.message);
    }
    return items;
}

/**
 * Search for recent news — Strategy:
 *   1. DuckDuckGo (query + "ข่าวล่าสุด")
 *   2. Google Custom Search API (dateRestrict=d7)
 *   3. Wikipedia
 */
async function searchNews(query) {
    const num = 5;

    // === Attempt 1: DuckDuckGo with news keywords ===
    const ddgResults = await searchDuckDuckGo(query + ' ข่าวล่าสุด วันนี้', num);
    if (ddgResults.length > 0) return ddgResults;

    // === Attempt 2: Google Custom Search API with date filter ===
    if (GOOGLE_API_KEY && GOOGLE_CX) {
        try {
            console.log('[News] DDG returned 0 results, trying Google API...');
            const url = 'https://www.googleapis.com/customsearch/v1';
            const response = await axios.get(url, {
                params: {
                    key: GOOGLE_API_KEY,
                    cx: GOOGLE_CX,
                    q: query + ' ข่าว',
                    num: num,
                    hl: 'th',
                    gl: 'th',
                    sort: 'date',
                    dateRestrict: 'd7',
                },
                timeout: 10000,
            });

            const items = (response.data.items || []).map(item => ({
                title: item.title,
                link: item.link,
                snippet: item.snippet || 'ข่าวล่าสุด',
            }));

            if (items.length > 0) return items;
        } catch (err) {
            console.warn('[News] Google API failed:', err.response?.status, err.message);
        }
    }

    // === Attempt 3: Just search Wikipedia ===
    return await searchWikipedia(query, num);
}

module.exports = { searchGoogle, searchNews };
