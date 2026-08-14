
//backend url

const Data = {
    USER_API: 'https://user-service-0cbz.onrender.com/api',
    PATTERN_API: 'https://pattern-service-6jrp.onrender.com/api',
    COMMUNITY_API: 'https://community-service-ev6n.onrender.com/api',
    PAYMENT_API: 'https://payment-service-ayj0.onrender.com/api',
    
    // store id in localstorage

    setUserId: function(id) {
        if (id) {
            localStorage.setItem('userId', parseInt(id));
        }
    },
    
    //remove id from storage
    logout: function() {
        localStorage.removeItem('userId');
    },
    
    //get user from storage
    async getCurrentUser() {
        let userId = localStorage.getItem('userId');
        if (!userId) return null;
        
        try {
            let user = await this.call(this.USER_API + '/users/' + parseInt(userId));
            return user;
        } catch {
            return null;
        }
    },
    
    // api call

    async call(url, method = 'GET', data = null) {
        let options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) {
            options.body = JSON.stringify(data);
        }

        let response = await fetch(url, options);
        let result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Something went wrong');
        }
        return result;
    },

    //various api calls

    register: function(username, password) {
        return this.call(this.USER_API + '/auth/register', 'POST', { username, password });
    },

    login: function(username, password) {
        return this.call(this.USER_API + '/auth/login', 'POST', { username, password });
    },

    getUser: function(id) {
        return this.call(this.USER_API + '/users/' + id);
    },

    becomeSeller: function(id) {
        return this.call(this.USER_API + '/users/' + id + '/become-seller', 'POST');
    },

    addFunds: function(id, amount) {
        return this.call(this.USER_API + '/users/' + id + '/wallet/add', 'POST', { amount });
    },

    getPatterns: function() {
        return this.call(this.PATTERN_API + '/patterns');
    },

    getPattern: function(id) {
    return this.call(this.PATTERN_API + '/patterns/' + id);
    },

    createPattern: function(data) {
        return this.call(this.PATTERN_API + '/patterns', 'POST', data);
    },

    updatePattern: function(id, data) {
        return this.call(this.PATTERN_API + '/patterns/' + id, 'PUT', data);
    },

    deletePattern: function(id, userId) {
        return this.call(this.PATTERN_API + '/patterns/' + id + '?user_id=' + userId, 'DELETE');
    },

    // add purchase to storage
    purchase: function(userId, patternId, amount) {
        return this.call(this.PAYMENT_API + '/payments/purchase', 'POST', {
            user_id: userId,
            pattern_id: patternId,
            amount: amount
        });
    },

    getPurchases: function(userId) {
        return this.call(this.PAYMENT_API + '/payments/purchases/' + userId);
    },

    getPosts: function() {
        return this.call(this.COMMUNITY_API + '/community/posts');
    },

    createPost: function(data) {
        return this.call(this.COMMUNITY_API + '/community/posts', 'POST', data);
    },

    toggleLike: function(postId, userId) {
        return this.call(this.COMMUNITY_API + '/community/posts/' + postId + '/toggle-like?user_id=' + userId, 'POST');
    },

    addComment: function(postId, data) {
        return this.call(this.COMMUNITY_API + '/community/posts/' + postId + '/comment', 'POST', data);
    }
};

window.Data = Data;