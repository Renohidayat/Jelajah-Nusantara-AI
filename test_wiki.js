const query = "bandung";
const url = `https://id.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages&format=json&pithumbsize=800&origin=*`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    console.log(pages[pageId].thumbnail ? pages[pageId].thumbnail.source : "No image");
  });
