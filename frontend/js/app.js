let allPatterns = [];
let allPosts = [];

// ============================================================
// NAVIGATION
// ============================================================
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
    });

    let target = document.getElementById('page-' + page);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    }

    if (page === 'home') loadHome();
    if (page === 'marketplace') loadMarketplace();
    if (page === 'profile') loadProfile();
    if (page === 'community') loadCommunity();
}

// ============================================================
// USER DISPLAY
// ============================================================
async function updateUserDisplay() {
    let user = await Data.getCurrentUser();

    if (user) {
        let wallet = (user.wallet || 0).toFixed(2);
        document.getElementById('userDisplay').textContent = user.username;
        document.getElementById('walletDisplay').style.display = 'inline';
        document.getElementById('walletAmount').textContent = '€' + wallet;
        document.getElementById('logoutBtn').style.display = 'inline';
        document.getElementById('addPatternBtn').style.display = user.is_seller ? 'inline' : 'none';
        document.getElementById('loginNavBtn').style.display = 'none';
        document.getElementById('registerNavBtn').style.display = 'none';
    } else {
        document.getElementById('userDisplay').textContent = 'Guest';
        document.getElementById('walletDisplay').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('addPatternBtn').style.display = 'none';
        document.getElementById('loginNavBtn').style.display = 'inline';
        document.getElementById('registerNavBtn').style.display = 'inline';
    }
}

// ============================================================
// LOGIN
// ============================================================
async function login(event) {
    event.preventDefault();
    let username = document.getElementById('loginUsername').value.trim();
    let password = document.getElementById('loginPassword').value;

    try {
        let result = await Data.login(username, password);
        if (result.success) {
            Data.setUserId(parseInt(result.user.id));
            await updateUserDisplay();
            document.getElementById('loginForm').reset();
            showPage('home');
            alert('Welcome back, ' + username + '!');
        }
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
// REGISTER
// ============================================================
async function register(event) {
    event.preventDefault();
    let username = document.getElementById('regUsername').value.trim();
    let password = document.getElementById('regPassword').value;
    let confirm = document.getElementById('regConfirm').value;

    if (password !== confirm) {
        alert('Passwords do not match');
        return;
    }

    try {
        let result = await Data.register(username, password);
        if (result.success) {
            Data.setUserId(parseInt(result.user.id));
            await updateUserDisplay();
            document.getElementById('registerForm').reset();
            showPage('home');
            alert('Welcome ' + username + '! You get 10 euros free credit.');
        }
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
// LOGOUT
// ============================================================
function logout() {
    Data.logout();
    updateUserDisplay();
    showPage('home');
    alert('Logged out');
}

// ============================================================
// HOME
// ============================================================
async function loadHome() {
    try {
        let patterns = await Data.getPatterns();
        allPatterns = patterns;
        let sellers = new Set(patterns.map(p => p.seller_name));
        let posts = await Data.getPosts();
        allPosts = posts;

        document.getElementById('totalPatterns').textContent = patterns.length;
        document.getElementById('totalSellers').textContent = sellers.size;
        document.getElementById('totalPosts').textContent = posts.length;

        let featured = patterns.slice(0, 4);
        renderPatterns(featured, 'featuredGrid');
    } catch (error) {
        console.log('Home error:', error);
        document.getElementById('featuredGrid').innerHTML = '<p>Error loading patterns</p>';
    }
}

// ============================================================
// MARKETPLACE
// ============================================================
async function loadMarketplace() {
    try {
        let patterns = await Data.getPatterns();
        allPatterns = patterns;
        renderPatterns(patterns, 'patternGrid');
    } catch (error) {
        console.log('Marketplace error:', error);
        document.getElementById('patternGrid').innerHTML = '<p>Error loading patterns</p>';
    }
}

// ============================================================
// SEARCH
// ============================================================
function searchPatterns() {
    let query = document.getElementById('searchInput').value.toLowerCase();
    let skill = document.getElementById('skillFilter').value;
    let price = document.getElementById('priceFilter').value;

    let patterns = allPatterns;

    if (query) {
        patterns = patterns.filter(p =>
            p.title.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query)
        );
    }
    if (skill !== 'all') {
        patterns = patterns.filter(p => p.skill_level === skill);
    }
    if (price === 'free') {
        patterns = patterns.filter(p => p.price === 0);
    } else if (price === 'paid') {
        patterns = patterns.filter(p => p.price > 0);
    }

    renderPatterns(patterns, 'patternGrid');
}

// ============================================================
// RENDER PATTERNS
// ============================================================
function renderPatterns(patterns, containerId) {
    let container = document.getElementById(containerId);
    if (!container) return;

    if (patterns.length === 0) {
        container.innerHTML = '<p>No patterns found</p>';
        return;
    }

    let html = '';
    patterns.forEach(p => {
        let img = p.image_url;
        if (img && img.startsWith('/images/')) {
            img = 'http://localhost:8081' + img;
        }

        html += `
            <div class="card" onclick="viewPattern(${p.id})">
                <div style="width:100%;height:150px;background:#f5f0eb;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
                    <img src="${img}" 
                         alt="${p.title}" 
                         style="width:100%;height:100%;object-fit:cover;"
                         onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'color:#999;font-size:14px;\\'>No Image</span>'">
                </div>
                <h3>${p.title}</h3>
                <p>By: ${p.seller_name}</p>
                <p>${p.price === 0 ? 'Free' : '€' + p.price.toFixed(2)}</p>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ============================================================
// VIEW PATTERN
// ============================================================
async function viewPattern(id) {
    let pattern = allPatterns.find(p => p.id === id);
    if (!pattern) return;

    let user = await Data.getCurrentUser();
    let hasPurchased = false;

    if (user) {
        try {
            let purchases = await Data.getPurchases(user.id);
            hasPurchased = purchases.purchases && purchases.purchases.some(p => p.pattern_id === id);
        } catch (e) {}
    }

    let isOwner = user && user.is_seller && pattern.seller_id === user.id;

    let actionsHtml = '<div style="margin-top:15px;padding-top:15px;border-top:1px solid #eee;display:flex;flex-wrap:wrap;gap:10px;">';
    
    if (isOwner) {
        actionsHtml += `<button onclick="deletePattern(${pattern.id})" style="background:#d32f2f;color:white;border:none;padding:8px 18px;border-radius:4px;cursor:pointer;">Delete Pattern</button>`;
    } else if (pattern.price === 0) {
        actionsHtml += `<button onclick="getFreePattern(${pattern.id})" style="background:#1976d2;color:white;border:none;padding:8px 18px;border-radius:4px;cursor:pointer;">Get Pattern (Free)</button>`;
    } else if (hasPurchased) {
        actionsHtml += `<button onclick="showDetails(${pattern.id})" style="background:#6b2d5c;color:white;border:none;padding:8px 18px;border-radius:4px;cursor:pointer;">View Full Pattern</button>`;
    } else {
        actionsHtml += `<button onclick="buyPattern(${pattern.id}, ${pattern.price})" style="background:#2e7d32;color:white;border:none;padding:8px 18px;border-radius:4px;cursor:pointer;">Buy €${pattern.price.toFixed(2)}</button>`;
    }
    
    actionsHtml += '</div>';

    let walletInfo = '';
    if (user) {
        walletInfo = `<p><strong>Your balance:</strong> €${(user.wallet || 0).toFixed(2)}</p>`;
    }

    let html = `
        <div style="display:flex;flex-direction:column;gap:12px;">
            <img src="${pattern.image_url || '/images/0.jpg'}" 
                 alt="${pattern.title}" 
                 style="width:100%;max-height:250px;object-fit:cover;border-radius:4px;"
                 onerror="this.src='/images/0.jpg'">
            
            <h2 style="margin:0;font-size:22px;">${pattern.title}</h2>
            <p style="margin:0;color:#666;"><strong>By:</strong> ${pattern.seller_name}</p>
            <p style="margin:0;"><strong>Skill Level:</strong> ${pattern.skill_level}</p>
            <p style="margin:0;"><strong>Category:</strong> ${pattern.category}</p>
            <p style="margin:0;"><strong>Price:</strong> ${pattern.price === 0 ? 'Free' : '€' + pattern.price.toFixed(2)}</p>
            <p style="margin:0;">${pattern.description}</p>
            ${walletInfo}
            ${actionsHtml}
        </div>
    `;

    document.getElementById('patternDetail').innerHTML = html;
    document.getElementById('patternPopup').style.display = 'flex';
}

// ============================================================
// BUY PATTERN
// ============================================================
async function buyPattern(id, price) {
    let user = await Data.getCurrentUser();
    if (!user) {
        alert('Please login first');
        showPage('login');
        return;
    }

    if ((user.wallet || 0) < price) {
        alert('Insufficient funds! You have €' + (user.wallet || 0).toFixed(2));
        return;
    }

    if (!confirm('Buy this pattern for €' + price.toFixed(2) + '?')) return;

    try {
        let result = await Data.purchase(user.id, id, price);
        if (result.success) {
            await updateUserDisplay();
            alert('Purchased! Balance: €' + result.balance.toFixed(2));
            closePopup('patternPopup');

            if (result.purchase && result.purchase.pattern_details) {
                document.getElementById('detailsTitle').textContent = 'Pattern Details';
                document.getElementById('detailsContent').textContent = result.purchase.pattern_details;
                document.getElementById('detailsPopup').style.display = 'flex';
            }
        }
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
// GET FREE PATTERN
// ============================================================
async function getFreePattern(id) {
    let user = await Data.getCurrentUser();
    if (!user) {
        alert('Please login first');
        showPage('login');
        return;
    }

    try {
        let result = await Data.purchase(user.id, id, 0);
        if (result.success) {
            alert('Pattern added to your library!');
            closePopup('patternPopup');

            if (result.purchase && result.purchase.pattern_details) {
                document.getElementById('detailsTitle').textContent = 'Pattern Details';
                document.getElementById('detailsContent').textContent = result.purchase.pattern_details;
                document.getElementById('detailsPopup').style.display = 'flex';
            }
        }
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
// SHOW DETAILS
// ============================================================
function showDetails(id) {
    let pattern = allPatterns.find(p => p.id === id);
    if (!pattern) return;

    document.getElementById('detailsTitle').textContent = pattern.title + ' - Pattern Details';
    document.getElementById('detailsContent').textContent = pattern.pattern_details || 'No details available.';
    document.getElementById('detailsPopup').style.display = 'flex';
    closePopup('patternPopup');
}

// ============================================================
// DELETE PATTERN
// ============================================================
async function deletePattern(id) {
    if (!confirm('Delete this pattern?')) return;
    let user = await Data.getCurrentUser();
    if (!user) return;

    try {
        await Data.deletePattern(id, user.id);
        alert('Pattern deleted');
        closePopup('patternPopup');
        loadMarketplace();
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
// ADD PATTERN
// ============================================================
async function showAddPattern() {
    let user = await Data.getCurrentUser();
    if (!user) {
        alert('Please login first');
        showPage('login');
        return;
    }
    if (!user.is_seller) {
        alert('You must be a designer to add patterns');
        return;
    }
    document.getElementById('addPatternPopup').style.display = 'flex';
    document.getElementById('addPatternForm').reset();
}

async function addPattern(event) {
    event.preventDefault();

    let user = await Data.getCurrentUser();
    if (!user) return;

    let data = {
        title: document.getElementById('apTitle').value.trim(),
        description: document.getElementById('apDescription').value.trim(),
        price: parseFloat(document.getElementById('apPrice').value) || 0,
        image_url: document.getElementById('apImage').value.trim() || '/images/0.jpg',
        pattern_details: document.getElementById('apDetails').value.trim(),
        seller_id: user.id,
        seller_name: user.username,
        craft_type: 'crochet',
        skill_level: 'beginner',
        category: 'accessories'
    };

    let validation = Security.validatePattern(data);
    if (!validation.valid) {
        alert(Object.values(validation.errors).join('\n'));
        return;
    }

    try {
        let result = await Data.createPattern(data);
        if (result) {
            alert('Pattern published!');
            closePopup('addPatternPopup');
            document.getElementById('addPatternForm').reset();
            loadMarketplace();
        }
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
// PROFILE
// ============================================================
async function loadProfile() {
    let user = await Data.getCurrentUser();
    
    if (!user) {
        document.getElementById('profileContent').innerHTML = `
            <div style="border:1px solid #ddd;padding:20px;border-radius:6px;">
                <p>Please login to view your profile.</p>
                <button onclick="showPage('login')" style="background:#6b2d5c;color:white;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;">Login</button>
            </div>
        `;
        return;
    }

    try {
        let wallet = user.wallet || 0;
        let purchases = await Data.getPurchases(user.id);
        let purchasedPatterns = purchases.purchases || [];
        let allPatternsData = await Data.getPatterns();
        
        let purchasedPatternData = [];
        for (let p of purchasedPatterns) {
            let pattern = allPatternsData.find(pat => pat.id === p.pattern_id);
            if (pattern) {
                purchasedPatternData.push(pattern);
            }
        }

        let userPatterns = [];
        if (user.is_seller) {
            userPatterns = allPatternsData.filter(p => p.seller_id === user.id);
        }

        let html = `
            <div style="border:1px solid #ddd;padding:25px;border-radius:8px;max-width:600px;background:white;">
                <div style="display:flex;align-items:center;gap:20px;margin-bottom:15px;">
                    <div style="width:60px;height:60px;background:#6b2d5c;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;">${user.username.charAt(0).toUpperCase()}</div>
                    <div>
                        <h3 style="margin:0;">${user.username}</h3>
                        <p style="margin:0;color:#666;">${user.is_seller ? 'Seller' : 'Viewer'}</p>
                    </div>
                    <div style="margin-left:auto;text-align:right;">
                        <div style="font-size:22px;font-weight:700;color:#2e7d32;">€${wallet.toFixed(2)}</div>
                        <button onclick="addFunds()" style="background:#ddd;border:none;padding:4px 14px;border-radius:4px;cursor:pointer;font-size:12px;">Add Funds</button>
                    </div>
                </div>

                <hr style="border:none;border-top:1px solid #eee;margin:15px 0;">

                <h4>Purchased Patterns (${purchasedPatternData.length})</h4>
                ${purchasedPatternData.length === 0 ? '<p style="color:#999;">No patterns purchased yet.</p>' : ''}
                <ul style="list-style:none;padding:0;">
                    ${purchasedPatternData.map(p => `
                        <li style="padding:6px 0;border-bottom:1px solid #f5f0eb;display:flex;justify-content:space-between;">
                            <span>${p.title}</span>
                            <span style="color:#666;font-size:14px;">${p.price === 0 ? 'Free' : '€' + p.price.toFixed(2)}</span>
                        </li>
                    `).join('')}
                </ul>

                ${user.is_seller ? `
                    <hr style="border:none;border-top:1px solid #eee;margin:15px 0;">
                    <h4>My Patterns (${userPatterns.length})</h4>
                    ${userPatterns.length === 0 ? '<p style="color:#999;">No patterns listed yet.</p>' : ''}
                    <ul style="list-style:none;padding:0;">
                        ${userPatterns.map(p => `
                            <li style="padding:6px 0;border-bottom:1px solid #f5f0eb;display:flex;justify-content:space-between;">
                                <span>${p.title}</span>
                                <span style="color:#666;font-size:14px;">${p.price === 0 ? 'Free' : '€' + p.price.toFixed(2)}</span>
                            </li>
                        `).join('')}
                    </ul>
                    <button onclick="showAddPattern()" style="background:#6b2d5c;color:white;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;margin-top:10px;">Add New Pattern</button>
                ` : `
                    <hr style="border:none;border-top:1px solid #eee;margin:15px 0;">
                    <h4>Become a Designer</h4>
                    <p style="color:#666;">Want to sell your own patterns?</p>
                    <button onclick="becomeSeller()" style="background:#6b2d5c;color:white;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;">Become a Designer</button>
                `}
            </div>
        `;

        document.getElementById('profileContent').innerHTML = html;

    } catch (error) {
        console.error('Profile error:', error);
        document.getElementById('profileContent').innerHTML = '<p style="color:red;">Error loading profile: ' + error.message + '</p>';
    }
}

// ============================================================
// ADD FUNDS
// ============================================================
async function addFunds() {
    let user = await Data.getCurrentUser();
    if (!user) return;

    let amount = prompt('Enter amount to add:', '5');
    if (!amount) return;
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) {
        alert('Enter a valid amount');
        return;
    }

    try {
        let result = await Data.addFunds(user.id, amount);
        if (result.success) {
            await updateUserDisplay();
            alert('Added €' + amount.toFixed(2) + '! New balance: €' + result.balance.toFixed(2));
            loadProfile();
        }
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
// BECOME SELLER
// ============================================================
async function becomeSeller() {
    let user = await Data.getCurrentUser();
    if (!user) return;

    if (!confirm('Become a pattern seller?')) return;

    try {
        let result = await Data.becomeSeller(user.id);
        if (result.success) {
            await updateUserDisplay();
            alert('You are now a designer!');
            loadProfile();
        }
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
// COMMUNITY
// ============================================================
async function loadCommunity() {
    try {
        let posts = await Data.getPosts();
        allPosts = posts;
        renderPosts(posts);
    } catch (error) {
        console.log('Community error:', error);
    }
}

async function renderPosts(posts) {
    let container = document.getElementById('communityContent');
    if (!posts || posts.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:20px;color:#999;">No posts yet</p>';
        return;
    }

    let user = await Data.getCurrentUser();

    let html = '';
    posts.forEach(post => {
        let comments = post.comments || [];
        let commentHtml = comments.map(c =>
            `<div style="background:#f5f0eb;padding:5px 10px;border-radius:4px;margin-bottom:4px;">
                <strong>${c.username}</strong>: ${c.content}
            </div>`
        ).join('');

        html += `
            <div style="border:1px solid #ddd;padding:18px;border-radius:6px;margin-bottom:12px;background:white;">
                <h3 style="margin:0 0 4px 0;">${post.title}</h3>
                <p style="margin:0;color:#777;font-size:14px;">By: ${post.username}</p>
                <p style="margin:10px 0;">${post.content}</p>
                <div style="margin-top:10px;display:flex;gap:15px;">
                    <button onclick="toggleLike(${post.id})" style="background:none;border:none;cursor:pointer;color:#666;padding:0;">
                        Likes: ${post.likes || 0}
                    </button>
                    <button onclick="toggleComments(${post.id})" style="background:none;border:none;cursor:pointer;color:#666;padding:0;">
                        Comments: ${comments.length}
                    </button>
                </div>
                <div id="comments-${post.id}" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid #f0ece8;">
                    ${commentHtml}
                    ${user ? `
                        <div style="margin-top:8px;display:flex;gap:8px;">
                            <input type="text" id="comment-${post.id}" placeholder="Write a comment..." style="flex:1;padding:6px 12px;border:1px solid #ddd;border-radius:4px;">
                            <button onclick="addComment(${post.id})" style="background:#6b2d5c;color:white;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;">Post</button>
                        </div>
                    ` : `<p style="color:#999;font-size:14px;">Login to comment</p>`}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function toggleComments(postId) {
    let div = document.getElementById('comments-' + postId);
    div.style.display = div.style.display === 'none' ? 'block' : 'none';
}

async function toggleLike(postId) {
    let user = await Data.getCurrentUser();
    if (!user) {
        alert('Please login first');
        showPage('login');
        return;
    }

    try {
        let result = await Data.toggleLike(postId, user.id);
        if (result.success) {
            loadCommunity();
        }
    } catch (error) {
        console.log('Like error:', error);
    }
}

async function addComment(postId) {
    let user = await Data.getCurrentUser();
    if (!user) {
        alert('Please login first');
        return;
    }

    let input = document.getElementById('comment-' + postId);
    let content = input.value.trim();
    if (!content) {
        alert('Enter a comment');
        return;
    }

    try {
        let result = await Data.addComment(postId, {
            user_id: user.id,
            username: user.username,
            content: content
        });
        if (result) {
            input.value = '';
            loadCommunity();
        }
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
// ADD POST
// ============================================================
function showAddPost() {
    let user = Data.getCurrentUser();
    if (!user) {
        alert('Please login first');
        showPage('login');
        return;
    }
    document.getElementById('addPostPopup').style.display = 'flex';
    document.getElementById('addPostForm').reset();
}

async function addPost(event) {
    event.preventDefault();

    let user = await Data.getCurrentUser();
    if (!user) return;

    let data = {
        user_id: user.id,
        username: user.username,
        title: document.getElementById('postTitle').value.trim(),
        content: document.getElementById('postContent').value.trim()
    };

    let validation = Security.validatePost(data);
    if (!validation.valid) {
        alert(Object.values(validation.errors).join('\n'));
        return;
    }

    try {
        let result = await Data.createPost(data);
        if (result) {
            alert('Post published!');
            closePopup('addPostPopup');
            document.getElementById('addPostForm').reset();
            loadCommunity();
        }
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
// POPUP HELPERS
// ============================================================
function closePopup(id) {
    document.getElementById(id).style.display = 'none';
}

document.addEventListener('click', function(e) {
    if (e.target.classList && e.target.classList.contains('popup')) {
        e.target.style.display = 'none';
    }
});

// ============================================================
// INIT
// ============================================================
updateUserDisplay();
showPage('home');
console.log('All You Can Knit ready!');