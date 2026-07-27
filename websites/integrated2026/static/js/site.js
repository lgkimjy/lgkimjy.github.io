const zoomableImages = document.querySelectorAll(".figure-frame img, .result-card img");

if (zoomableImages.length) {
  const lightbox = document.createElement("dialog");
  lightbox.className = "image-lightbox";
  lightbox.setAttribute("aria-label", "Image preview");
  lightbox.innerHTML = `
    <figure>
      <button class="lightbox-close" type="button" aria-label="Close image preview">X</button>
      <img alt="" />
    </figure>
  `;

  document.body.append(lightbox);

  const previewImage = lightbox.querySelector("img");
  const closeButton = lightbox.querySelector(".lightbox-close");

  const resetLightbox = () => {
    document.body.classList.remove("lightbox-open");
    previewImage.removeAttribute("src");
    previewImage.alt = "";
  };

  const closeLightbox = () => {
    if (lightbox.open) {
      lightbox.close();
    }
  };

  zoomableImages.forEach((image) => {
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", `Open image preview: ${image.alt}`);

    const openLightbox = () => {
      previewImage.src = image.currentSrc || image.src;
      previewImage.alt = image.alt;
      lightbox.showModal();
      document.body.classList.add("lightbox-open");
      closeButton.focus();
    };

    image.addEventListener("click", openLightbox);
    image.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox();
      }
    });
  });

  closeButton.addEventListener("click", closeLightbox);

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox || event.target === previewImage) {
      closeLightbox();
    }
  });

  lightbox.addEventListener("close", resetLightbox);
}
