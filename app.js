// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc, 
    onSnapshot,
    orderBy,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC-rqaKa4n91jc2uB0mewa9c4wuOkbMmGM",
    authDomain: "resqgo-d902e.firebaseapp.com",
    projectId: "resqgo-d902e",
    storageBucket: "resqgo-d902e.appspot.com",
    messagingSenderId: "965330497907",
    appId: "1:965330497907:android:62b1c73b18e02392df5506"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements
const loginContainer = document.getElementById('login-container');
const adminContent = document.getElementById('admin-content');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const userEmail = document.getElementById('user-email');
const logoutButton = document.getElementById('logout-btn');
const statusFilter = document.getElementById('status-filter');
const requestsTable = document.getElementById('requests-table');
const requestsTableBody = document.getElementById('requests-table-body');
const loadingIndicator = document.getElementById('loading-indicator');
const noDataMessage = document.getElementById('no-data-message');
const requestDetailsModal = document.getElementById('request-modal');
const closeModalBtn = document.getElementById('close-modal');
const requestDetailsContent = document.getElementById('request-details');
const acceptButton = document.getElementById('accept-btn');
const rejectButton = document.getElementById('reject-btn');

// Stats elements
const pendingCount = document.getElementById('pending-count');
const acceptedCount = document.getElementById('accepted-count');
const rejectedCount = document.getElementById('rejected-count');
const totalCount = document.getElementById('total-count');

// Add DOM elements for admin management
const adminCreateForm = document.getElementById('admin-create-form');
const userEmailInput = document.getElementById('admin-user-email');
const adminStatus = document.getElementById('admin-status');

// Current request being viewed
let currentRequestId = null;
let allRequests = [];
let unsubscribe = null;

// Authentication state observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        loginContainer.style.display = 'none';
        adminContent.style.display = 'block';
        userEmail.textContent = user.email;
        
        // Set up Firestore listener based on current filter
        setupFirestoreListener();
    } else {
        // User is signed out
        loginContainer.style.display = 'block';
        adminContent.style.display = 'none';
        userEmail.textContent = '';
        
        // Clear any existing listener
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    }
});

// Login form submission
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    loginError.textContent = '';
    
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Check if user has admin role
            const user = userCredential.user;
            
            // Get user document from Firestore
            const userDocRef = doc(db, "users", user.uid);
            getDoc(userDocRef)
                .then((docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const userData = docSnapshot.data();
                        
                        // Check if user has admin role
                        if (userData.role === "admin") {
                            // User is admin, proceed with login
                            console.log("Admin login successful");
                            // Auth state change listener will handle the rest
                        } else {
                            // User is not an admin, sign them out
                            signOut(auth).then(() => {
                                loginError.textContent = "Access denied. Only administrators can access this panel.";
                            });
                        }
                    } else {
                        // User document doesn't exist
                        signOut(auth).then(() => {
                            loginError.textContent = "User profile not found. Please contact support.";
                        });
                    }
                })
                .catch((error) => {
                    console.error("Error checking admin status:", error);
                    signOut(auth).then(() => {
                        loginError.textContent = "Error verifying account. Please try again.";
                    });
                });
        })
        .catch((error) => {
            const errorMessage = error.message;
            loginError.textContent = errorMessage;
        });
});

// Logout button
logoutButton.addEventListener('click', () => {
    signOut(auth)
        .then(() => {
            // Logout handled by onAuthStateChanged
        })
        .catch((error) => {
            console.error('Error signing out:', error);
        });
});

// Status filter change
statusFilter.addEventListener('change', () => {
    setupFirestoreListener();
});

// Close the modal when clicking the close button
closeModalBtn.addEventListener('click', () => {
    requestDetailsModal.style.display = 'none';
});

// Close the modal when clicking outside of it
window.addEventListener('click', (e) => {
    if (e.target === requestDetailsModal) {
        requestDetailsModal.style.display = 'none';
    }
});

// Set up Firestore listener based on status filter
function setupFirestoreListener() {
    // Clear any existing listener
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    
    loadingIndicator.style.display = 'flex';
    requestsTableBody.innerHTML = '';
    noDataMessage.style.display = 'none';
    
    let q = collection(db, "help_requests");
    q = query(q, orderBy("timestamp", "desc"));
    
    const selectedFilter = statusFilter.value;
    if (selectedFilter !== 'all') {
        q = query(q, where("status", "==", selectedFilter));
    }
    
    unsubscribe = onSnapshot(q, (querySnapshot) => {
        loadingIndicator.style.display = 'none';
        
        // Store all requests in the allRequests array
        allRequests = querySnapshot.docs.map(doc => {
            return {
                id: doc.id,
                ...doc.data()
            };
        });
        
        if (querySnapshot.empty) {
            noDataMessage.style.display = 'block';
            requestsTableBody.innerHTML = '';
        } else {
            noDataMessage.style.display = 'none';
            
            // Clear existing table rows
            requestsTableBody.innerHTML = '';
            
            // Populate table with service requests
            querySnapshot.forEach(doc => {
                const request = doc.data();
                const row = createRequestRow(doc.id, request);
                requestsTableBody.appendChild(row);
            });
        }
        
        // Update statistics
        updateStatistics();
    }, error => {
        console.error('Error getting service requests:', error);
        loadingIndicator.style.display = 'none';
        noDataMessage.style.display = 'block';
        noDataMessage.textContent = `Error loading data: ${error.message}`;
    });
}

// Create a table row for a service request
function createRequestRow(id, request) {
    const row = document.createElement('tr');
    
    // Format timestamp
    let timestamp = 'N/A';
    if (request.timestamp) {
        if (request.timestamp.toDate) {
            timestamp = new Date(request.timestamp.toDate()).toLocaleString();
        } else if (request.timestamp.seconds) {
            timestamp = new Date(request.timestamp.seconds * 1000).toLocaleString();
        } else {
            timestamp = new Date(request.timestamp).toLocaleString();
        }
    }
    
    // Create status badge
    const statusBadge = document.createElement('span');
    statusBadge.textContent = request.status || 'pending';
    statusBadge.className = `status-badge status-${request.status || 'pending'}`;
    
    // Create view button
    const viewBtn = document.createElement('button');
    viewBtn.innerHTML = '<i class="fas fa-eye"></i> View Details';
    viewBtn.className = 'btn btn-primary';
    viewBtn.style.marginRight = '5px';
    viewBtn.addEventListener('click', () => showRequestDetails(id));
    
    // Build the row
    row.innerHTML = `
        <td>${id.substring(0, 8)}...</td>
        <td>${request.userEmail || 'N/A'}</td>
        <td>${request.itemNeeded || 'N/A'}</td>
        <td>${request.emergencyType || 'N/A'}</td>
        <td>${timestamp}</td>
        <td>${request.locationName || 'N/A'}</td>
    `;
    
    // Add status badge
    const statusCell = document.createElement('td');
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);
    
    // Add action button
    const actionCell = document.createElement('td');
    actionCell.appendChild(viewBtn);
    row.appendChild(actionCell);
    
    return row;
}

// Show request details in modal
function showRequestDetails(requestId) {
    // Find the request by ID
    const request = allRequests.find(req => req.id === requestId);
    if (!request) return;
    
    // Store current request ID
    currentRequestId = requestId;
    
    // Format timestamp
    const timestamp = request.timestamp ? new Date(request.timestamp.seconds * 1000) : new Date();
    const formattedDate = timestamp.toLocaleDateString();
    const formattedTime = timestamp.toLocaleTimeString();
    
    // Create HTML for request details
    let detailsHtml = `
        <div class="detail-item">
            <div class="detail-label">Request ID:</div>
            <div class="detail-value">${request.id}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">User:</div>
            <div class="detail-value">${request.userEmail || 'Anonymous'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Emergency Type:</div>
            <div class="detail-value">${request.emergencyType || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Agent Type:</div>
            <div class="detail-value">${request.agentType || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Item Needed:</div>
            <div class="detail-value">${request.itemNeeded || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Time Requested:</div>
            <div class="detail-value">${formattedDate} ${formattedTime}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Location:</div>
            <div class="detail-value">${request.locationName || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Coordinates:</div>
            <div class="detail-value">Lat: ${request.latitude}, Lng: ${request.longitude}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Notes:</div>
            <div class="detail-value">${request.notes || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Status:</div>
            <div class="detail-value status-${request.status}">${request.status}</div>
        </div>
    `;
    
    // Update modal content
    requestDetailsContent.innerHTML = detailsHtml;
    
    // Show/hide action buttons based on status
    if (request.status === 'pending') {
        acceptButton.style.display = 'block';
        rejectButton.style.display = 'block';
        
        // Add event listeners to action buttons
        acceptButton.onclick = () => updateRequestStatus(currentRequestId, 'accepted');
        rejectButton.onclick = () => updateRequestStatus(currentRequestId, 'rejected');
    } else {
        acceptButton.style.display = 'none';
        rejectButton.style.display = 'none';
    }
    
    // Show modal
    requestDetailsModal.style.display = 'block';
}

// Update request status
async function updateRequestStatus(requestId, status) {
    try {
        // Update status in Firestore
        const requestRef = doc(db, "help_requests", requestId);
        await updateDoc(requestRef, {
            status: status,
            updatedAt: new Date()
        });
        
        // Close modal
        requestDetailsModal.style.display = 'none';
        
        // Show success message
        alert(`Request ${status} successfully`);
    } catch (error) {
        console.error("Error updating request status: ", error);
        alert("Error updating request status. Please try again.");
    }
}

// Update statistics
function updateStatistics() {
    // Count requests by status from allRequests array
    const pendingRequests = allRequests.filter(req => req.status === 'pending').length;
    const acceptedRequests = allRequests.filter(req => req.status === 'accepted').length;
    const rejectedRequests = allRequests.filter(req => req.status === 'rejected').length;
    const totalRequests = allRequests.length;
    
    // Update UI
    pendingCount.textContent = pendingRequests;
    acceptedCount.textContent = acceptedRequests;
    rejectedCount.textContent = rejectedRequests;
    totalCount.textContent = totalRequests;
}

// Show/hide loading indicator
function showLoading(show) {
    if (show) {
        loadingIndicator.style.display = 'flex';
        noDataMessage.style.display = 'none';
    } else {
        loadingIndicator.style.display = 'none';
    }
}

// Init function updated to hide admin management initially
function init() {
    // Hide admin content initially
    adminContent.style.display = 'none';
    
    // Hide the request details modal initially
    requestDetailsModal.style.display = 'none';
    
    // Set the first tab as active by default
    const defaultTab = document.getElementById('requests-tab-content');
    if (defaultTab) {
        defaultTab.classList.add('active');
    }
}

// Tab switching functionality
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Get the target tab content id from the button id
            const targetId = button.id.replace('tab-', '') + '-tab-content';
            const targetPane = document.getElementById(targetId);
            
            if (targetPane) {
                targetPane.classList.add('active');
                
                // Load data for the active tab if needed
                if (targetId === 'sos-tab-content') {
                    loadSosAlerts();
                } else if (targetId === 'requests-tab-content') {
                    setupFirestoreListener();
                }
            }
        });
    });
}

// Start the app
init();

// Setup tab navigation after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupTabNavigation();
});

// Admin create form submission
adminCreateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get user email
    const userEmail = userEmailInput.value.trim();
    if (!userEmail) {
        showAdminStatus('Please enter a valid email address', false);
        return;
    }
    
    // Clear previous status
    showAdminStatus('', null);
    
    try {
        // Query Firestore to find the user by email
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", userEmail));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            showAdminStatus(`No user found with email: ${userEmail}`, false);
            return;
        }
        
        // Get the first user document
        const userDoc = querySnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        // Check if user is already an admin
        if (userData.role === "admin") {
            showAdminStatus(`User ${userEmail} is already an admin`, false);
            return;
        }
        
        // Update user's role to admin
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            role: "admin",
            updatedAt: new Date()
        });
        
        // Show success message
        showAdminStatus(`User ${userEmail} has been set as an admin successfully!`, true);
        
        // Clear form
        userEmailInput.value = '';
    } catch (error) {
        console.error("Error setting user as admin:", error);
        showAdminStatus(`Error: ${error.message}`, false);
    }
});

// Show admin status message
function showAdminStatus(message, isSuccess) {
    adminStatus.textContent = message;
    
    // Reset classes
    adminStatus.classList.remove('success', 'error');
    
    if (isSuccess === true) {
        adminStatus.classList.add('success');
    } else if (isSuccess === false) {
        adminStatus.classList.add('error');
    }
}

// ==================== SOS Alerts Feature ====================

// Load and render SOS alerts
function loadSosAlerts() {
    const sosTableBody = document.getElementById('sos-alerts-body');
    const noData = document.getElementById('sos-no-data');
    const loadingIndicator = document.getElementById('sos-loading-indicator');
    const filter = document.getElementById('sos-status-filter')?.value || 'all';

    // Show loading indicator
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    sosTableBody.innerHTML = '';
    noData.style.display = 'none';

    let sosRef = collection(db, "sosAlerts");
    let q = query(sosRef, orderBy("timestamp", "desc"));

    if (filter !== 'all') {
        q = query(sosRef, where("status", "==", filter), orderBy("timestamp", "desc"));
    }

    getDocs(q)
        .then(snapshot => {
            // Hide loading indicator
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            
            if (snapshot.empty) {
                noData.style.display = 'block';
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const row = document.createElement('tr');

                const timestamp = data.timestamp?.seconds
                    ? new Date(data.timestamp.seconds * 1000).toLocaleString()
                    : 'N/A';
                    
                // Create status badge
                const statusBadge = document.createElement('span');
                statusBadge.textContent = data.status || 'unknown';
                statusBadge.className = `status-badge status-${data.status || 'unknown'}`;
                
                // Create action button
                const actionCell = document.createElement('td');
                if (data.status === 'active') {
                    const resolveBtn = document.createElement('button');
                    resolveBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mark Resolved';
                    resolveBtn.className = 'btn btn-success';
                    resolveBtn.style.padding = '0.6rem 1rem';
                    resolveBtn.style.fontWeight = '500';
                    resolveBtn.addEventListener('click', () => markSosResolved(doc.id));
                    actionCell.appendChild(resolveBtn);
                } else {
                    // Show a disabled button for resolved alerts
                    const resolvedLabel = document.createElement('span');
                    resolvedLabel.innerHTML = '<i class="fas fa-check"></i> Resolved';
                    resolvedLabel.className = 'btn btn-outline-success';
                    resolvedLabel.style.opacity = '0.7';
                    resolvedLabel.style.cursor = 'default';
                    actionCell.appendChild(resolvedLabel);
                }

                // Build the row
                row.innerHTML = `
                    <td>${doc.id.slice(0, 8)}...</td>
                    <td>${data.deviceInfo || 'Unknown'}</td>
                    <td>${data.latitude || 'N/A'}</td>
                    <td>${data.longitude || 'N/A'}</td>
                    <td>${timestamp}</td>
                    <td>${data.userId || 'N/A'}</td>
                `;
                
                // Add status badge
                const statusCell = document.createElement('td');
                statusCell.appendChild(statusBadge);
                
                // Insert status cell at position 4 (after longitude)
                row.insertBefore(statusCell, row.children[4]);
                
                // Add action button
                row.appendChild(actionCell);

                sosTableBody.appendChild(row);
            });
            
            // Update SOS statistics after loading alerts
            updateSosStatistics();
        })
        .catch(error => {
            console.error("Error loading SOS alerts:", error);
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            noData.textContent = "Failed to load SOS alerts.";
            noData.style.display = 'block';
        });
}

// Update SOS statistics
function updateSosStatistics() {
    const activeCount = document.getElementById('active-sos-count');
    const resolvedCount = document.getElementById('resolved-sos-count');
    const totalCount = document.getElementById('total-sos-count');
    
    // Get counts from Firestore
    const sosRef = collection(db, "sosAlerts");
    
    // Get total count
    getDocs(sosRef).then(snapshot => {
        if (totalCount) totalCount.textContent = snapshot.size;
        
        // Count by status
        let active = 0;
        let resolved = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'active') active++;
            else if (data.status === 'resolved') resolved++;
        });
        
        if (activeCount) activeCount.textContent = active;
        if (resolvedCount) resolvedCount.textContent = resolved;
    }).catch(error => {
        console.error("Error getting SOS statistics:", error);
    });
}

// Update SOS status to resolved
async function markSosResolved(id) {
    try {
        const sosRef = doc(db, "sosAlerts", id);
        await updateDoc(sosRef, {
            status: "resolved",
            updatedAt: new Date()
        });
        alert("SOS marked as resolved.");
        loadSosAlerts(); // Refresh
        updateSosStatistics(); // Update statistics
    } catch (err) {
        console.error("Error updating SOS alert:", err);
        alert("Failed to mark as resolved.");
    }
}

// Make markSosResolved available globally
window.markSosResolved = markSosResolved;

// Listen for status filter changes
const sosFilterDropdown = document.getElementById('sos-status-filter');
if (sosFilterDropdown) {
    sosFilterDropdown.addEventListener('change', loadSosAlerts);
}

// Load initial data when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Initialize other components first
    init();
    
    // Then load data if user is authenticated
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Setup tab navigation
            setupTabNavigation();
            
            // Only load data for the active tab initially
            const activeTab = document.querySelector('.tab-pane.active');
            if (activeTab) {
                if (activeTab.id === 'sos-tab-content') {
                    loadSosAlerts();
                } else if (activeTab.id === 'requests-tab-content') {
                    setupFirestoreListener();
                }
            }
        }
    });
});