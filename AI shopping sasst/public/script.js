document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const micBtn = document.getElementById('mic-btn');
    const shoppingListUL = document.getElementById('shopping-list');
    const suggestionsDiv = document.getElementById('suggestions');
    const feedbackText = document.getElementById('feedback-text');
    const placeholder = document.getElementById('placeholder');
    const getRecipeBtn = document.getElementById('get-recipe-btn');
    const smartSuggestionBtn = document.getElementById('smart-suggestion-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Recipe Modal
    const recipeModal = document.getElementById('recipe-modal');
    const recipeModalContent = document.getElementById('recipe-modal-content');
    const closeRecipeModalBtn = document.getElementById('close-recipe-modal-btn');
    
    // Error Modal
    const errorModal = document.getElementById('error-modal');
    const errorModalContent = document.getElementById('error-modal-content');
    const closeErrorModalBtn = document.getElementById('close-error-modal-btn');


    // --- State ---
    let shoppingList = [];
    let isListening = false;

    // --- Gemini API Configuration ---
    const apiKey = "AIzaSyCIpnb0w2Y4-ZhTMHHDbCY3Gtsiv_vDDsc"; // This should be securely managed
    const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    // --- Speech Recognition Setup ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        micBtn.disabled = true;
        micBtn.style.backgroundColor = '#999';
        showFeedback("Voice commands are not supported on this browser.", true);
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // --- Event Listeners ---
    micBtn.addEventListener('click', () => isListening ? recognition.stop() : recognition.start());
    getRecipeBtn.addEventListener('click', handleGetRecipeClick);
    smartSuggestionBtn.addEventListener('click', renderSuggestions);
    closeRecipeModalBtn.addEventListener('click', () => recipeModal.classList.add('hidden'));
    closeErrorModalBtn.addEventListener('click', () => errorModal.classList.add('hidden'));


    recognition.onstart = () => {
        isListening = true;
        micBtn.classList.add('recording');
        micBtn.querySelector('i').classList.replace('fa-microphone', 'fa-stop');
        showFeedback('Listening...');
    };

    recognition.onend = () => {
        isListening = false;
        micBtn.classList.remove('recording');
        micBtn.querySelector('i').classList.replace('fa-stop', 'fa-microphone');
        clearFeedback();
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        let errorMessage = 'An unknown error occurred.';
        if (event.error === 'no-speech') {
            errorMessage = "I didn't hear anything. Please try again.";
        } else if (event.error === 'not-allowed') {
            errorMessage = 'Microphone access was denied.';
        }
        showFeedback(errorMessage, true);
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        showFeedback(`You said: "${transcript}"`);
        processCommand(transcript);
    };

    // --- Command Processing ---
    function processCommand(command) {
        const nlpResult = nlp.process(command);
        console.log('NLP Result:', nlpResult);

        switch (nlpResult.intent) {
            case 'add':
                addItem(nlpResult.item, nlpResult.quantity);
                break;
            case 'remove':
                removeItem(nlpResult.item);
                break;
            case 'clear':
                clearList();
                break;
            case 'search':
                searchItem(nlpResult.item);
                break;
            case 'item_not_found':
                showErrorModal(`Sorry, the item "${nlpResult.item}" was not recognized. Please try saying it again clearly.`);
                return;
            default:
                showFeedback("Sorry, I didn't understand that.", true);
        }
        renderList();
    }

    // --- Gemini API Functions ---
    async function callGemini(prompt, isJson = false) {
        loadingSpinner.classList.remove('hidden');
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: isJson ? {
                responseMimeType: "application/json",
                responseSchema: { type: "OBJECT", properties: { "suggestions": { type: "ARRAY", items: { "type": "STRING" } } } }
            } : {}
        };
        try {
            const response = await fetch(textApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("No content received from API.");
            return text;
        } catch (error) {
            console.error("Gemini API call failed:", error);
            showErrorModal("Couldn't connect to the smart assistant. Please check your connection.");
            return null;
        } finally {
            loadingSpinner.classList.add('hidden');
        }
    }

    async function handleGetRecipeClick() {
        if (shoppingList.length < 2) {
            showFeedback("Add at least two items to get recipe ideas.", true);
            return;
        }
        const items = shoppingList.map(i => i.name).join(', ');
        const prompt = `I have: ${items}. Suggest a simple recipe. Format the response in simple HTML with h4 for titles, p for text, ul and li for lists.`;
        const recipeHtml = await callGemini(prompt);
        if (recipeHtml) {
            recipeModalContent.innerHTML = recipeHtml;
            recipeModal.classList.remove('hidden');
        }
    }

    // --- Shopping List Management ---
    function addItem(itemName, quantity = 1) {
        if (!itemName) return;
        const existingItem = shoppingList.find(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            shoppingList.push({ name: itemName, quantity, category: categorizeItem(itemName), id: Date.now(), done: false });
        }
        showFeedback(`Added ${quantity} ${itemName}(s)`);
    }

    function removeItem(itemName) {
        const itemToRemove = shoppingList.find(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (!itemToRemove) {
            showErrorModal(`Could not find "${itemName}" in the list.`);
            return;
        }
        
        const itemElement = document.querySelector(`[data-id='${itemToRemove.id}']`);
        if (itemElement) {
            itemElement.classList.add('list-item-exit');
            itemElement.addEventListener('animationend', () => {
                shoppingList = shoppingList.filter(i => i.id !== itemToRemove.id);
                renderList();
            }, { once: true });
        } else {
            shoppingList = shoppingList.filter(i => i.id !== itemToRemove.id);
            renderList();
        }
        showFeedback(`Removed ${itemName}`);
    }

    function clearList() {
        shoppingList = [];
        showFeedback('Shopping list cleared.');
    }

    function toggleItemDone(itemId) {
        const item = shoppingList.find(i => i.id === itemId);
        if (item) {
            item.done = !item.done;
            renderList();
        }
    }

    function searchItem(itemName) {
        showFeedback(`Searching for "${itemName}"... (Feature simulated)`, false);
    }

    // --- UI Rendering ---
    function renderList() {
        const oldScrollTop = shoppingListUL.scrollTop;
        shoppingListUL.innerHTML = '';
        getRecipeBtn.disabled = shoppingList.length < 2;

        if (shoppingList.length === 0) {
            placeholder.classList.remove('hidden');
            shoppingListUL.appendChild(placeholder);
        } else {
            placeholder.classList.add('hidden');
            const categorized = shoppingList.reduce((acc, item) => {
                const category = item.category || 'Other';
                if (!acc[category]) acc[category] = [];
                acc[category].push(item);
                return acc;
            }, {});

            Object.keys(categorized).sort().forEach(category => {
                const categoryHeader = document.createElement('li');
                categoryHeader.className = 'px-4 py-2 bg-gray-50/80 backdrop-blur-sm sticky top-0';
                categoryHeader.innerHTML = `<h3 class="text-sm font-semibold uppercase text-gray-500">${category}</h3>`;
                shoppingListUL.appendChild(categoryHeader);

                categorized[category].forEach(item => {
                    const li = document.createElement('li');
                    li.className = `flex items-center justify-between p-4 transition-all duration-300 ${item.done ? 'bg-green-100' : 'bg-transparent'}`;
                    li.dataset.id = item.id;
                    
                    if (!document.querySelector(`[data-id='${item.id}']`)) {
                        li.classList.add('list-item-enter');
                    }

                    li.innerHTML = `
                        <div class="flex items-center cursor-pointer flex-1" onclick="toggleItemDone(${item.id})">
                            <span class="w-8 h-8 flex items-center justify-center rounded-full ${getCategoryColor(item.category)} text-white mr-4 text-xs font-bold">${item.quantity}x</span>
                            <span class="font-medium ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}">${item.name}</span>
                        </div>
                        <button class="text-red-400 hover:text-red-600 transition-colors" onclick="handleRemoveClick('${item.name}')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    `;
                    shoppingListUL.appendChild(li);
                });
            });
        }
        shoppingListUL.scrollTop = oldScrollTop;
    }

    async function renderSuggestions() {
        suggestionsDiv.innerHTML = '<div class="spinner !border-t-primary-accent !border-gray-300"></div>';
        const items = shoppingList.map(i => i.name);
        const prompt = `Based on these items: ${items.join(', ') || 'nothing'}. Suggest 4 complementary items. Provide a JSON object with a "suggestions" key holding an array of strings.`;
        
        const resultJson = await callGemini(prompt, true);
        if (resultJson) {
            try {
                const parsed = JSON.parse(resultJson);
                suggestionsDiv.innerHTML = '';
                parsed.suggestions.forEach(suggestion => {
                    const button = document.createElement('button');
                    button.className = 'px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium hover:bg-violet-200 transition-all transform hover:scale-105';
                    button.textContent = `+ ${suggestion}`;
                    button.onclick = () => {
                        addItem(suggestion);
                        renderList();
                    };
                    suggestionsDiv.appendChild(button);
                });
            } catch (e) {
                console.error("Failed to parse suggestions JSON:", e);
                suggestionsDiv.innerHTML = '<p class="text-xs text-red-500">Could not load ideas.</p>';
            }
        } else {
            suggestionsDiv.innerHTML = '<p class="text-xs text-red-500">Could not load ideas.</p>';
        }
    }
    
    function showFeedback(message, isError = false) {
        feedbackText.textContent = message;
        feedbackText.className = `feedback ${isError ? 'text-red-500' : 'text-gray-600'}`;
        feedbackText.style.opacity = '1';
    }

    function clearFeedback() {
        feedbackText.style.opacity = '0';
        setTimeout(() => { feedbackText.textContent = ''; }, 300);
    }

    function showErrorModal(message) {
        errorModalContent.innerHTML = `<p class="text-gray-600">${message}</p>`;
        errorModal.classList.remove('hidden');
    }

    // --- Helpers ---
    window.handleRemoveClick = (itemName) => {
        removeItem(itemName);
    }
    window.toggleItemDone = toggleItemDone;

    function categorizeItem(itemName) {
        const name = itemName.toLowerCase();
        if (['milk', 'cheese', 'yogurt', 'butter'].some(s => name.includes(s))) return 'Dairy & Eggs';
        if (['apple', 'banana', 'grapes', 'strawberry', 'mango', 'potato', 'onion', 'tomato', 'carrot', 'spinach'].some(s => name.includes(s))) return 'Produce';
        if (['bread', 'pasta', 'cereal', 'rice', 'flour'].some(s => name.includes(s))) return 'Bakery & Grains';
        if (['chicken', 'beef', 'fish', 'pork'].some(s => name.includes(s))) return 'Meat & Seafood';
        if (['chips', 'cookies', 'crackers', 'chocolate'].some(s => name.includes(s))) return 'Snacks';
        if (['lentils', 'sugar', 'salt', 'oil', 'tea', 'coffee', 'spices'].some(s => name.includes(s))) return 'Pantry Staples';
        return 'Miscellaneous';
    }

    function getCategoryColor(category) {
        const colors = {
            'Dairy & Eggs': 'bg-blue-400',
            'Produce': 'bg-green-500',
            'Bakery & Grains': 'bg-yellow-500',
            'Meat & Seafood': 'bg-red-500',
            'Snacks': 'bg-purple-500',
            'Pantry Staples': 'bg-orange-500',
            'Miscellaneous': 'bg-gray-400'
        };
        return colors[category] || 'bg-gray-400';
    }

    // --- Initial Render ---
    renderList();
    renderSuggestions();
});

