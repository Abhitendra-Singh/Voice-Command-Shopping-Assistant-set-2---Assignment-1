const nlp = {
    // Dictionary for English and Hindi/Hinglish number words
    wordToNum: {
        'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'एक': 1, 'ek': 1,
        'दो': 2, 'do': 2,
        'तीन': 3, 'teen': 3,
        'चार': 4, 'chaar': 4, 'char': 4,
        'पांच': 5, 'paanch': 5, 'panch': 5,
        'छह': 6, 'chhah': 6, 'che': 6,
        'सात': 7, 'saat': 7, 'sat': 7,
        'आठ': 8, 'aath': 8, 'ath': 8,
        'नौ': 9, 'nau': 9, 'no': 9,
        'दस': 10, 'das': 10,
    },

    // Expanded translation map for common Hindi/Hinglish grocery items to English
    translations: {
        // Fruits
        'सेब': 'Apple', 'apple': 'Apple', 'apples': 'Apples', 'अपल्स': 'Apples', 'सेव': 'Apple', 'sev': 'Apple',
        'केला': 'Banana', 'banana': 'Banana', 'बनाना': 'Banana', 'bananas': 'Bananas', 'बनानास': 'Bananas', 'kele': 'Banana', 'केले': 'Banana',
        'आम': 'Mango', 'mango': 'Mango', 'aam': 'Mango',
        'संतरा': 'Orange', 'orange': 'Orange', 'santara': 'Orange',
        'अंगूर': 'Grapes', 'grapes': 'Grapes', 'angoor': 'Grapes',
        'अनार': 'Pomegranate', 'pomegranate': 'Pomegranate', 'anar': 'Pomegranate',

        // Vegetables
        'आलू': 'Potato', 'potato': 'Potato', 'aalu': 'Potato',
        'प्याज': 'Onion', 'onion': 'Onion', 'pyaz': 'Onion',
        'टमाटर': 'Tomato', 'tomato': 'Tomato', 'tamatar': 'Tomato',
        'गाजर': 'Carrot', 'carrot': 'Carrot', 'gajar': 'Carrot',
        'पालक': 'Spinach', 'spinach': 'Spinach', 'palak': 'Spinach',
        'गोभी': 'Cauliflower', 'cauliflower': 'Cauliflower', 'gobhi': 'Cauliflower',
        'मटर': 'Peas', 'peas': 'Peas', 'matar': 'Peas',
        'लहसुन': 'Garlic', 'garlic': 'Garlic', 'lahsun': 'Garlic',
        'अदरक': 'Ginger', 'ginger': 'Ginger', 'adrak': 'Ginger',

        // Dairy & Bakery
        'दूध': 'Milk', 'milk': 'Milk', 'doodh': 'Milk',
        'ब्रेड': 'Bread', 'bread': 'Bread',
        'अंडा': 'Egg', 'egg': 'Egg', 'anda': 'Egg',
        'अंडे': 'Eggs', 'eggs': 'Eggs', 'ande': 'Eggs',
        'पनीर': 'Cheese', 'cheese': 'Cheese', 'paneer': 'Cheese',
        'दही': 'Yogurt', 'yogurt': 'Yogurt', 'dahi': 'Yogurt',
        'मक्खन': 'Butter', 'butter': 'Butter', 'makkhan': 'Butter',

        // Staples
        'चावल': 'Rice', 'rice': 'Rice', 'chawal': 'Rice',
        'आटा': 'Flour', 'flour': 'Flour', 'aata': 'Flour',
        'चीनी': 'Sugar', 'sugar': 'Sugar', 'cheeni': 'Sugar',
        'नमक': 'Salt', 'salt': 'Salt', 'namak': 'Salt',
        'दाल': 'Lentils', 'lentils': 'Lentils', 'dal': 'Lentils',
        'तेल': 'Oil', 'oil': 'Oil', 'tel': 'Oil',

        // Meat
        'चिकन': 'Chicken', 'chicken': 'Chicken',

        // Beverages
        'चाय': 'Tea', 'tea': 'Tea', 'chai': 'Tea',
        'कॉफी': 'Coffee', 'coffee': 'Coffee',
    },

    process: function(text) {
        const lowerCaseText = text.toLowerCase().trim();
        let intent = 'unknown';
        let item = null;
        let quantity = 1;
        let filters = {};
        let matchFound = false;

        // 1. Check for a 'clear list' intent first
        if (this.keywords.clear.some(k => lowerCaseText.includes(k))) {
            intent = 'clear';
            matchFound = true;
        } else {
            // 2. Loop through other intents to find the best keyword match
            for (const currentIntent of ['remove', 'add', 'search']) {
                const sortedKeywords = this.keywords[currentIntent].sort((a, b) => b.length - a.length);
                const foundKeyword = sortedKeywords.find(k => lowerCaseText.includes(k));
                
                if (foundKeyword) {
                    intent = currentIntent;
                    item = lowerCaseText.replace(foundKeyword, '').trim();
                    matchFound = true;
                    break; 
                }
            }
        }
        
        // 3. Default to 'add' if no other intent is found
        if (!matchFound && lowerCaseText.length > 0) {
            intent = 'add';
            item = lowerCaseText;
        }

        // 4. Extract quantity FIRST, then translate the remaining item
        if (item) {
            let quantityResult = { quantity: 1, item: item };

            // 5. Extract quantity only if adding
            if (intent === 'add') {
                 quantityResult = this.extractQuantity(item);
            }
            
            quantity = quantityResult.quantity;
            const itemToTranslate = quantityResult.item;

            const translatedItem = this.translateItem(itemToTranslate);

            if (translatedItem) {
                item = translatedItem; 
            } else if (intent === 'add' || intent === 'remove') {
                // If translation fails, set a specific 'item_not_found' intent
                intent = 'item_not_found';
                item = itemToTranslate; // Use the text after quantity extraction
            }
        }
        
        // 6. Extract search filters
        if (intent === 'search' && item) {
             filters = this.extractFilters(item);
        }

        // 7. Final capitalization for display (but not for error messages)
        if (item && intent !== 'item_not_found') {
            item = item.charAt(0).toUpperCase() + item.slice(1);
        }

        return { intent, item, quantity, filters };
    },

    translateItem: function(text) {
        const words = text.split(' ');
        let bestMatch = null;

        // Find the most relevant English translation from the spoken words
        for (const word of words) {
            if (this.translations[word]) {
                bestMatch = this.translations[word];
                break;
            }
        }
        return bestMatch;
    },

    extractQuantity: function(text) {
        const words = text.split(' ');
        const potentialQuantity = words[0];
        let quantity = 1;
        let item = text;

        // Check for a digit
        if (!isNaN(parseInt(potentialQuantity))) {
            quantity = parseInt(potentialQuantity);
            item = words.slice(1).join(' ').trim();
        } 
        // Check for a number word (English or Hindi/Hinglish)
        else if (this.wordToNum[potentialQuantity.toLowerCase()]) {
            quantity = this.wordToNum[potentialQuantity.toLowerCase()];
            item = words.slice(1).join(' ').trim();
        }

        return { quantity, item };
    },

    extractFilters: function(text) {
        const filters = {};
        const priceMatch = text.match(/(under|less than)\s\$?(\d+)/);
        if (priceMatch) {
            filters.price = parseInt(priceMatch[2]);
        }
        const brandMatch = text.match(/(by|brand)\s(\w+)/);
        if (brandMatch) {
            filters.brand = brandMatch[2];
        }
        return filters;
    },

    keywords: {
        add: ['add', 'i need', 'get me', 'buy', 'i want to buy', 'put on my list', 'जोड़ो', 'डालो', 'मुझे चाहिए', 'खरीदो', 'लेना है', 'ऐड करो', 'एड करो', 'ऐड', 'एड'],
        remove: ['remove', 'delete', 'take off', 'हटाओ', 'निकालो', 'डिलीट करो'],
        clear: ['clear my list', 'clear the list', 'start over', 'लिस्ट साफ़ करो', 'पूरी लिस्ट हटाओ'],
        search: ['find me', 'find', 'search for', 'look for', 'ढूंढो', 'खोजो']
    }
};

