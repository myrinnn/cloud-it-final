const Security = {


    sanitize: function(input) {
        if (typeof input !== 'string') return input;
        const map = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#x27;', '/': '&#x2F;'
        };
        return String(input).replace(/[&<>"'/]/g, s => map[s]);
    },

    
    sanitizeObject: function(obj) {

        if (typeof obj !== 'object' || obj === null) return obj;
        const result = {};
        for (let key in obj) {
            result[key] = typeof obj[key] === 'string' ? this.sanitize(obj[key]) : obj[key];
        }
        return result;

    },


    
    validatePattern: function(data) {

        const errors = {};
        let valid = true;
        
        if (!data.title || data.title.trim().length < 3) {
            errors.title = 'Title must be at least 3 characters';
            valid = false;
        }
        if (!data.description || data.description.trim().length < 10) {
            errors.description = 'Description must be at least 10 characters';
            valid = false;
        }
        if (!data.pattern_details || data.pattern_details.trim().length < 10) {
            errors.pattern_details = 'Pattern details must be at least 10 characters';
            valid = false;
        }
        const price = parseFloat(data.price);
        if (isNaN(price) || price < 0) {
            errors.price = 'Price must be a valid number (0 or greater)';
            valid = false;
        }

        
        return { valid, errors };
    },
    
    validatePost: function(data) {


        const errors = {};
        let valid = true;
        
        if (!data.title || data.title.trim().length < 3) {
            errors.title = 'Title must be at least 3 characters';
            valid = false;
        }
        if (!data.content || data.content.trim().length < 10) {
            errors.content = 'Content must be at least 10 characters';
            valid = false;
        }
        
        return { valid, errors };
    },
    
    validateLogin: function(data) {


        const errors = {};
        let valid = true;
        
        if (!data.username || data.username.trim().length < 1) {
            errors.username = 'Please enter a username';
            valid = false;
        }
        if (!data.password || data.password.length < 1) {
            errors.password = 'Please enter a password';
            valid = false;
        }
        
        return { valid, errors };
    },
    
    validateRegister: function(data) {

        const errors = {};
        let valid = true;
        
        if (!data.username || data.username.trim().length < 3) {
            errors.username = 'Username must be at least 3 characters';
            valid = false;
        }
        if (!data.password || data.password.length < 6) {
            errors.password = 'Password must be at least 6 characters';
            valid = false;
        }
        if (data.password !== data.confirmPassword) {
            errors.confirm = 'Passwords do not match';
            valid = false;
        }
        
        return { valid, errors };
    },
    
    escapeHTML: function(text) {
        
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.Security = Security;