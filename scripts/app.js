document.addEventListener("DOMContentLoaded", () => {
  // App State
  let currentRecipes = [];
  let favorites = JSON.parse(localStorage.getItem("flavorfind_favs") || "[]");
  let spoonacularKey = localStorage.getItem("spoonacular_api_key") || "a024c6242fcb4547b49371d0cdcce6a2";
  let isViewingFavorites = false;

  // DOM Elements
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const cuisineSelect = document.getElementById("cuisine-select");
  const dietSelect = document.getElementById("diet-select");
  const typeSelect = document.getElementById("type-select");
  const resetFiltersBtn = document.getElementById("reset-filters-btn");

  const recipeGrid = document.getElementById("recipe-grid");
  const sectionTitle = document.getElementById("section-title");
  const resultsCount = document.getElementById("results-count");
  const loadingSpinner = document.getElementById("loading-spinner");
  const emptyState = document.getElementById("empty-state");
  const errorMessage = document.getElementById("error-message");

  const recipeModal = document.getElementById("recipe-modal");
  const modalBody = document.getElementById("modal-body");
  const modalCloseBtn = document.getElementById("modal-close-btn");

  const themeToggle = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  const viewFavoritesBtn = document.getElementById("view-favorites-btn");
  const favCountBadge = document.getElementById("fav-count-badge");

  const apiSettingsBtn = document.getElementById("api-settings-btn");
  const apiModal = document.getElementById("api-modal");
  const apiModalClose = document.getElementById("api-modal-close");
  const apiKeyForm = document.getElementById("api-key-form");
  const apiKeyInput = document.getElementById("api-key-input");
  const clearApiKeyBtn = document.getElementById("clear-api-key");

  // 1. Theme Configuration
  const initTheme = () => {
    const savedTheme = localStorage.getItem("flavorfind_theme");
    if (savedTheme === "dark") {
      document.body.classList.add("dark-mode");
      themeIcon.classList.replace("fa-moon", "fa-sun");
    }
  };

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    themeIcon.classList.toggle("fa-sun", isDark);
    themeIcon.classList.toggle("fa-moon", !isDark);
    localStorage.setItem("flavorfind_theme", isDark ? "dark" : "light");
  });

  // 2. Favorites UI Badge Sync
  const updateFavBadge = () => {
    favCountBadge.textContent = favorites.length;
  };

  const isFavorited = (id) => favorites.some((f) => String(f.id) === String(id));

  const toggleFavorite = (recipe) => {
    const index = favorites.findIndex((f) => String(f.id) === String(recipe.id));
    if (index > -1) {
      favorites.splice(index, 1);
    } else {
      favorites.push({
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        cuisine: recipe.cuisine || "Various",
        readyInMinutes: recipe.readyInMinutes || 30,
        servings: recipe.servings || 2,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || "Instructions available upon opening recipe."
      });
    }
    localStorage.setItem("flavorfind_favs", JSON.stringify(favorites));
    updateFavBadge();

    if (isViewingFavorites) {
      renderRecipes(favorites);
    } else {
      renderRecipes(currentRecipes);
    }
  };

  // 3. API Fetching Logic (Spoonacular with TheMealDB Fallback)
  const fetchRecipes = async (query = "chicken", cuisine = "", diet = "", type = "") => {
    showLoading(true);
    errorMessage.style.display = "none";
    emptyState.style.display = "none";
    recipeGrid.innerHTML = "";

    try {
      if (spoonacularKey) {
        // Query Spoonacular API
        const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
        url.searchParams.append("apiKey", spoonacularKey);
        url.searchParams.append("query", query);
        url.searchParams.append("number", "12");
        url.searchParams.append("addRecipeInformation", "true");
        url.searchParams.append("fillIngredients", "true");
        if (cuisine) url.searchParams.append("cuisine", cuisine);
        if (diet) url.searchParams.append("diet", diet);
        if (type) url.searchParams.append("type", type);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Spoonacular Error: ${response.statusText}`);
        const data = await response.json();

        currentRecipes = (data.results || []).map((r) => ({
          id: r.id,
          title: r.title,
          image: r.image,
          cuisine: cuisine || "International",
          readyInMinutes: r.readyInMinutes,
          servings: r.servings,
          ingredients: (r.extendedIngredients || []).map((i) => i.original),
          instructions: r.instructions ? r.instructions.replace(/<[^>]*>?/gm, "") : "Follow cooking instructions step by step."
        }));
      } else {
        // Fallback: Free TheMealDB API
        const endpoint = query
          ? `https://www.themealdb.com/api/json/v1/1/search.s?s=${encodeURIComponent(query)}`
          : `https://www.themealdb.com/api/json/v1/1/search.s?s=chicken`;

        const response = await fetch(endpoint);
        if (!response.ok) throw new Error("Could not retrieve recipes from open database.");
        const data = await response.json();

        currentRecipes = (data.meals || []).map((m) => {
          // Parse ingredients from mealdb flat response
          const ingredients = [];
          for (let i = 1; i <= 20; i++) {
            const ing = m[`strIngredient${i}`];
            const measure = m[`strMeasure${i}`];
            if (ing && ing.trim()) ingredients.push(`${measure ? measure.trim() : ""} ${ing.trim()}`.trim());
          }

          return {
            id: m.idMeal,
            title: m.strMeal,
            image: m.strMealThumb,
            cuisine: m.strArea || "Global",
            readyInMinutes: 30,
            servings: 4,
            ingredients,
            instructions: m.strInstructions || "No detailed instructions provided."
          };
        });
      }

      isViewingFavorites = false;
      sectionTitle.textContent = query ? `Results for "${query}"` : "Featured Recipes";
      renderRecipes(currentRecipes);
    } catch (err) {
      errorMessage.textContent = `${err.message}. Showing cached/offline recommendations.`;
      errorMessage.style.display = "block";
    } finally {
      showLoading(false);
    }
  };

  // 4. Render Recipe Cards
  const renderRecipes = (recipes) => {
    recipeGrid.innerHTML = "";
    resultsCount.textContent = `${recipes.length} recipe${recipes.length === 1 ? "" : "s"} found`;

    if (recipes.length === 0) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    recipes.forEach((recipe) => {
      const card = document.createElement("div");
      card.className = "recipe-card";

      const favorited = isFavorited(recipe.id);

      card.innerHTML = `
        <div class="recipe-img-box">
          <img src="${recipe.image || 'https://via.placeholder.com/400x250?text=No+Image'}" alt="${recipe.title}" loading="lazy" />
          <button class="btn-card-fav ${favorited ? 'active' : ''}" data-id="${recipe.id}" aria-label="Save to favorites">
            <i class="fas fa-heart"></i>
          </button>
        </div>
        <div class="recipe-card-content">
          <h3>${recipe.title}</h3>
          <div class="recipe-meta-tags">
            <span class="recipe-badge"><i class="fas fa-clock"></i> ${recipe.readyInMinutes || 30} mins</span>
            <span class="recipe-badge"><i class="fas fa-globe"></i> ${recipe.cuisine}</span>
          </div>
          <button class="btn-details" data-id="${recipe.id}">View Recipe</button>
        </div>
      `;

      // Favorite toggle button click
      card.querySelector(".btn-card-fav").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(recipe);
      });

      // View recipe details modal
      card.querySelector(".btn-details").addEventListener("click", () => {
        openRecipeDetails(recipe);
      });

      recipeGrid.appendChild(card);
    });
  };

  // 5. Recipe Details Modal
  const openRecipeDetails = (recipe) => {
    const favorited = isFavorited(recipe.id);

    modalBody.innerHTML = `
      <img src="${recipe.image}" alt="${recipe.title}" class="modal-header-img" />
      <div class="modal-title-row">
        <h2>${recipe.title}</h2>
        <button id="modal-fav-toggle" class="icon-btn ${favorited ? 'active' : ''}">
          <i class="fas fa-heart" style="color: ${favorited ? '#ef4444' : 'inherit'}"></i>
        </button>
      </div>
      <div class="recipe-meta-tags">
        <span class="recipe-badge"><i class="fas fa-clock"></i> ${recipe.readyInMinutes} mins</span>
        <span class="recipe-badge"><i class="fas fa-user-friends"></i> Serves ${recipe.servings}</span>
        <span class="recipe-badge"><i class="fas fa-utensils"></i> ${recipe.cuisine}</span>
      </div>
      <div class="modal-section">
        <h4><i class="fas fa-carrot"></i> Ingredients</h4>
        <ul class="ingredients-list">
          ${recipe.ingredients.map((ing) => `<li>${ing}</li>`).join("")}
        </ul>
      </div>
      <div class="modal-section">
        <h4><i class="fas fa-list-ol"></i> Step-by-Step Instructions</h4>
        <p class="instructions-text">${recipe.instructions}</p>
      </div>
    `;

    document.getElementById("modal-fav-toggle").addEventListener("click", () => {
      toggleFavorite(recipe);
      openRecipeDetails(recipe);
    });

    recipeModal.classList.add("active");
    recipeModal.setAttribute("aria-hidden", "false");
  };

  const closeModal = (modal) => {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  };

  modalCloseBtn.addEventListener("click", () => closeModal(recipeModal));
  window.addEventListener("click", (e) => {
    if (e.target === recipeModal) closeModal(recipeModal);
    if (e.target === apiModal) closeModal(apiModal);
  });

  // 6. UI Handlers
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    const cuisine = cuisineSelect.value;
    const diet = dietSelect.value;
    const type = typeSelect.value;
    fetchRecipes(query, cuisine, diet, type);
  });

  resetFiltersBtn.addEventListener("click", () => {
    searchForm.reset();
    fetchRecipes();
  });

  viewFavoritesBtn.addEventListener("click", () => {
    isViewingFavorites = true;
    sectionTitle.textContent = "Your Saved Recipes";
    renderRecipes(favorites);
  });

  const showLoading = (show) => {
    loadingSpinner.style.display = show ? "block" : "none";
  };

  // 7. API Modal Handlers
  apiSettingsBtn.addEventListener("click", () => {
    apiKeyInput.value = spoonacularKey;
    apiModal.classList.add("active");
    apiModal.setAttribute("aria-hidden", "false");
  });

  apiModalClose.addEventListener("click", () => closeModal(apiModal));

  apiKeyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    spoonacularKey = apiKeyInput.value.trim();
    localStorage.setItem("spoonacular_api_key", spoonacularKey);
    closeModal(apiModal);
    fetchRecipes(searchInput.value || "pasta");
  });

  clearApiKeyBtn.addEventListener("click", () => {
    spoonacularKey = "";
    localStorage.removeItem("spoonacular_api_key");
    apiKeyInput.value = "";
    closeModal(apiModal);
    fetchRecipes();
  });

  // Initialization
  initTheme();
  updateFavBadge();
  fetchRecipes("pasta");
});