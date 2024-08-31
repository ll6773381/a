async function fetchNovelContent(url) {
  const response = await fetch(url);

  if (!response.ok) {
    console.error(
      `Failed to fetch content from ${url}. Status: ${response.status}`
    );
    return null;
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const content = doc.querySelector('#novel_content');

  if (!content) {
    console.error(`Failed to find '#novel_content' on the page: ${url}`);
    return null;
  }

  return cleanText(content.innerHTML);
}

function unescapeHTML(text) {
  const entities = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&apos;': "'",
    '&#039;': "'",
    '&nbsp;': ' ',
    '&ndash;': '–',
    '&mdash;': '—',
    '&lsquo;': '‘',
    '&rsquo;': '’',
    '&ldquo;': '“',
    '&rdquo;': '”',
  };

  Object.entries(entities).forEach(([entity, replacement]) => {
    const regex = new RegExp(entity, 'g');
    text = text.replace(regex, replacement);
  });

  return text;
}

function cleanText(text) {
  text = text.replace(/<div>/g, '');
  text = text.replace(/<\/div>/g, '');
  text = text.replace(/<p>/g, '\n');
  text = text.replace(/<\/p>/g, '\n');
  text = text.replace(/<br\s*[/]?>/g, '\n');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/ {2,}/g, ' ');
  text = text.replace(/\n{2,}/g, '\n\n');
  text = unescapeHTML(text);

  return text;
}

function createModal() {
  const modal = document.createElement('div');
  modal.id = 'downloadProgressModal';
  modal.style.display = 'block';
  modal.style.position = 'fixed';
  modal.style.zIndex = '1';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.overflow = 'auto';
  modal.style.backgroundColor = 'rgba(0,0,0,0.4)';

  const modalContent = document.createElement('div');
  modalContent.style.backgroundColor = '#fefefe';
  modalContent.style.position = 'relative';
  modalContent.style.margin = '15% auto 0';
  modalContent.style.padding = '20px';
  modalContent.style.border = '1px solid #888';
  modalContent.style.width = '50%';
  modalContent.style.textAlign = 'center';

  modal.appendChild(modalContent);

  return { modal, modalContent };
}

async function downloadNovel(title, episodeLinks, startEpisode) {
  let novelText = `${title}\nSPLITE___LINE\n`;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const { modal, modalContent } = createModal();
  document.body.appendChild(modal);

  const progressBar = document.createElement('div');
  progressBar.style.width = '0%';
  progressBar.style.height = '10px';
  progressBar.style.backgroundColor = '#008CBA';
  progressBar.style.marginTop = '10px';
  progressBar.style.borderRadius = '3px';
  modalContent.appendChild(progressBar);

  const progressLabel = document.createElement('div');
  progressLabel.style.marginTop = '5px';
  modalContent.appendChild(progressLabel);

  const startTime = new Date();
  const startingIndex = episodeLinks.length - startEpisode;

  for (let i = startingIndex; i >= 0; i--) {
    const episodeUrl = episodeLinks[i];

    if (!episodeUrl.startsWith('https://booktoki')) {
      console.log(`Skipping invalid episode link: ${episodeUrl}`);
      continue;
    }

    const logText = `Downloading: ${title} - Episode ${startingIndex - i + 1}/${
      startingIndex + 1
    }`;
    console.log(logText);

    const episodeContent = await fetchNovelContent(episodeUrl);

    if (!episodeContent) {
      console.error(`Failed to fetch content for episode: ${episodeUrl}`);
      progressBar.style.display = 'none';
      progressLabel.style.display = 'none';
      const errorLabel = document.createElement('div');
      errorLabel.textContent =
        'An error occurred. Please check the console for details.';
      modalContent.appendChild(errorLabel);
      return;
    }

    novelText += episodeContent + "SPLITE___LINE";


    const progress = ((startingIndex - i + 1) / (startingIndex + 1)) * 100;
    progressBar.style.width = `${progress}%`;

    const elapsedTime = new Date() - startTime;
    const estimatedTotalTime = (elapsedTime / progress) * 100;
    const remainingTime = estimatedTotalTime - elapsedTime;
    const remainingMinutes = Math.floor(remainingTime / (1000 * 60));
    const remainingSeconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

    progressLabel.textContent = `Downloading... ${progress.toFixed(
      2
    )}%  -  Remaining Time: ${remainingMinutes}m ${remainingSeconds}s`;

    await delay(Math.random() * 500 + 1000);
  }

  document.body.removeChild(modal);

  const fileName = `${title}(${startEpisode}~${episodeLinks.length}).txt`;
  const blob = new Blob([novelText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
}

function extractTitle() {
  const titleElement = document.evaluate(
    '//*[@id="content_wrapper"]/div[1]/span',
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;
  return titleElement ? titleElement.textContent.trim() : null;
}

function extractEpisodeLinks() {
  const episodeLinks = [];
  const links = document.querySelectorAll('.item-subject');

  links.forEach((link) => {
    const episodeLink = link.getAttribute('href');
    episodeLinks.push(episodeLink);
  });

  return episodeLinks;
}

async function fetchPage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to fetch page: ${url}. Status: ${response.status}`);
    return null;
  }
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc;
}

async function runCrawler() {
  const novelPageRule = 'https://booktoki';
  let currentUrl = window.location.href;

  // Clean URL
  const urlParts = currentUrl.split('?')[0];
  currentUrl = urlParts;

  if (!currentUrl.startsWith(novelPageRule)) {
    console.log('This script should be run on the novel episode list page.');
    return;
  }

  const title = extractTitle();

  if (!title) {
    console.log('Failed to extract the novel title.');
    return;
  }

  const totalPages = prompt(
    `Enter the total number of pages for the novel list (usually 1, 2 or more for novels with 1000+ story):`,
    '1'
  );

  if (!totalPages || isNaN(totalPages)) {
    console.log('Invalid page number or user canceled the input.');
    return;
  }

  const totalPagesNumber = parseInt(totalPages, 10);
  const allEpisodeLinks = [];

  for (let page = 1; page <= totalPagesNumber; page++) {
    const nextPageUrl = `${currentUrl}?spage=${page}`;
    const nextPageDoc = await fetchPage(nextPageUrl);
    if (nextPageDoc) {
      const nextPageLinks = Array.from(
        nextPageDoc.querySelectorAll('.item-subject')
      ).map((link) => link.getAttribute('href'));
      allEpisodeLinks.push(...nextPageLinks);
    }
  }

  const startEpisode = prompt(
    `Enter the starting episode number (1 to ${allEpisodeLinks.length}):`,
    '1'
  );

  if (!startEpisode || isNaN(startEpisode)) {
    console.log('Invalid episode number or user canceled the input.');
    return;
  }

  const startEpisodeNumber = parseInt(startEpisode, 10);

  if (startEpisodeNumber < 1 || startEpisodeNumber > allEpisodeLinks.length) {
    console.log(
      'Invalid episode number. Please enter a number between 1 and the total number of episodes.'
    );
    return;
  }

  console.log(
    `Task Appended: Preparing to download ${title} starting from episode ${startEpisodeNumber}`
  );

  downloadNovel(title, allEpisodeLinks, startEpisodeNumber);
}

runCrawler();
