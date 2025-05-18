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

// Help Requests elements
const requestsTab = document.getElementById('requests-tab');
const requestsSection = document.getElementById('requests-section');
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

// SOS Alerts elements
const sosTab = document.getElementById('sos-tab');
const sosSection = document.getElementById('sos-section');
const sosStatusFilter = document.getElementById('sos-status-filter');
const sosTable = document.getElementById('sos-table');
const sosTableBody = document.getElementById('sos-table-body');
const sosLoadingIndicator = document.getElementById('sos-loading-indicator');
const noSosMessage = document.getElementById('no-sos-message');
const sosModal = document.getElementById('sos-modal');
const closeSosModalBtn = document.getElementById('close-sos-modal');
const sosDetailsContent = document.getElementById('sos-details');
const resolveButton = document.getElementById('resolve-btn');
const contactButton = document.getElementById('contact-btn');

// Help Request Stats elements
const pendingCount = document.getElementById('pending-count');
const acceptedCount = document.getElementById('accepted-count');
const rejectedCount = document.getElementById('rejected-count');
const totalCount = document.getElementById('total-count');

// SOS Stats elements
const activeSOSCount = document.getElementById('active-sos-count');
const resolvedSOSCount = document.getElementById('resolved-sos-count');
const totalSOSCount = document.getElementById('total-sos-count');

// Add DOM elements for admin management
const adminCreateForm = document.getElementById('admin-create-form');
const userEmailInput = document.getElementById('admin-user-email');
const adminStatus = document.getElementById('admin-status');

// Current items being viewed
let currentRequestId = null;
let currentSOSId = null;
let allRequests = [];
let allSOSAlerts = [];
let unsubscribe = null;
let sosUnsubscribe = null;

// Authentication state observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        loginContainer.style.display = 'none';
        adminContent.style.display = 'block';
        userEmail.textContent = user.email;
        
        // Set up Firestore listeners
        setupFirestoreListener();
        setupSOSListener(); // Also set up SOS listener on login
    } else {
        // User is signed out
        loginContainer.style.display = 'block';
        adminContent.style.display = 'none';
        userEmail.textContent = '';
        
        // Clear any existing listeners
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        if (sosUnsubscribe) {
            sosUnsubscribe();
            sosUnsubscribe = null;
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

// Tab navigation
requestsTab.addEventListener('click', () => {
    // Show Help Requests tab content
    requestsSection.style.display = 'block';
    sosSection.style.display = 'none';
    // Show Help Requests stats
    document.getElementById('help-requests-stats').style.display = 'grid';
    document.getElementById('sos-alerts-stats').style.display = 'none';
    // Update active tab styling
    requestsTab.classList.add('active');
    sosTab.classList.remove('active');
});

sosTab.addEventListener('click', () => {
    // Show SOS Alerts tab content
    requestsSection.style.display = 'none';
    sosSection.style.display = 'block';
    // Show SOS Alerts stats
    document.getElementById('help-requests-stats').style.display = 'none';
    document.getElementById('sos-alerts-stats').style.display = 'grid';
    // Update active tab styling
    requestsTab.classList.remove('active');
    sosTab.classList.add('active');
    // Refresh SOS data
    setupSOSListener();
});

// Status filter change
statusFilter.addEventListener('change', () => {
    setupFirestoreListener();
});

// SOS status filter change
sosStatusFilter.addEventListener('change', () => {
    setupSOSListener();
});

// Close the request modal when clicking the close button
closeModalBtn.addEventListener('click', () => {
    requestDetailsModal.style.display = 'none';
});

// Close the SOS modal when clicking the close button
closeSosModalBtn.addEventListener('click', () => {
    sosModal.style.display = 'none';
});

// Close the modals when clicking outside of them
window.addEventListener('click', (e) => {
    if (e.target === requestDetailsModal) {
        requestDetailsModal.style.display = 'none';
    }
    if (e.target === sosModal) {
        sosModal.style.display = 'none';
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
    viewBtn.textContent = 'View Details';
    viewBtn.className = 'btn btn-primary';
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

// Update help request statistics
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

// Update SOS alerts statistics
function updateSOSStatistics() {
    // Count SOS alerts by status from allSOSAlerts array
    const activeSOS = allSOSAlerts.filter(alert => alert.status === 'active').length;
    const resolvedSOS = allSOSAlerts.filter(alert => alert.status === 'resolved').length;
    const totalSOS = allSOSAlerts.length;
    
    // Update UI
    if (activeSOSCount) activeSOSCount.textContent = activeSOS;
    if (resolvedSOSCount) resolvedSOSCount.textContent = resolvedSOS;
    if (totalSOSCount) totalSOSCount.textContent = totalSOS;
    
    console.log('SOS Statistics updated:', { active: activeSOS, resolved: resolvedSOS, total: totalSOS });
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

// Set up SOS alerts listener
function setupSOSListener() {
    // Clear any existing SOS listener
    if (sosUnsubscribe) {
        sosUnsubscribe();
        sosUnsubscribe = null;
    }
    
    sosLoadingIndicator.style.display = 'flex';
    sosTableBody.innerHTML = '';
    noSosMessage.style.display = 'none';
    
    console.log('Setting up SOS listener');
    
    let q = collection(db, "sosAlerts");
    // Don't filter by timestamp initially as it might not exist in all documents
    
    const selectedFilter = sosStatusFilter.value;
    if (selectedFilter !== 'all') {
        q = query(q, where("status", "==", selectedFilter));
    }
    
    sosUnsubscribe = onSnapshot(q, (querySnapshot) => {
        sosLoadingIndicator.style.display = 'none';
        
        // Store all SOS alerts in the allSOSAlerts array
        allSOSAlerts = querySnapshot.docs.map(doc => {
            return {
                id: doc.id,
                ...doc.data()
            };
        });
        
        if (querySnapshot.empty) {
            noSosMessage.style.display = 'block';
            sosTableBody.innerHTML = '';
        } else {
            noSosMessage.style.display = 'none';
            
            // Clear existing table rows
            sosTableBody.innerHTML = '';
            
            // Populate table with SOS alerts
            querySnapshot.forEach(doc => {
                const sosAlert = doc.data();
                const row = createSOSRow(doc.id, sosAlert);
                sosTableBody.appendChild(row);
            });
        }
        
        // Update SOS statistics
        updateSOSStatistics();
    }, error => {
        console.error('Error getting SOS alerts:', error);
        sosLoadingIndicator.style.display = 'none';
        noSosMessage.style.display = 'block';
        noSosMessage.textContent = `Error loading data: ${error.message}`;
    });
}

// Create a table row for an SOS alert
function createSOSRow(id, sosAlert) {
    const row = document.createElement('tr');
    
    // Format timestamp
    let timestamp = 'N/A';
    if (sosAlert.timestamp) {
        if (sosAlert.timestamp.toDate) {
            timestamp = new Date(sosAlert.timestamp.toDate()).toLocaleString();
        } else if (sosAlert.timestamp.seconds) {
            timestamp = new Date(sosAlert.timestamp.seconds * 1000).toLocaleString();
        } else if (typeof sosAlert.timestamp === 'string') {
            timestamp = sosAlert.timestamp; // Use the string timestamp directly
        } else {
            timestamp = new Date(sosAlert.timestamp).toLocaleString();
        }
    }
    
    // Get user information
    const userId = sosAlert.userId || 'Unknown';
    const userName = sosAlert.userName || 'Unknown User';
    
    // Create status badge
    const statusBadge = document.createElement('span');
    statusBadge.textContent = sosAlert.status || 'active';
    statusBadge.className = `status-badge status-${sosAlert.status || 'active'}`;
    if (sosAlert.status === 'active') {
        statusBadge.classList.add('emergency');
    }
    
    // Create location status badge
    const locationBadge = document.createElement('span');
    const hasLocation = sosAlert.hasLocation === true || (sosAlert.latitude && sosAlert.longitude);
    locationBadge.textContent = hasLocation ? 'Yes' : 'No';
    locationBadge.className = `status-badge status-${hasLocation ? 'accepted' : 'rejected'}`;
    
    // Create action buttons
    const actionDiv = document.createElement('div');
    actionDiv.className = 'action-buttons';
    
    // View details button
    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View Details';
    viewBtn.className = 'btn btn-primary btn-sm';
    viewBtn.addEventListener('click', () => {
        showSOSDetails(id);
    });
    actionDiv.appendChild(viewBtn);
    
    // Resolve button (only for active alerts)
    if (sosAlert.status === 'active') {
        const resolveBtn = document.createElement('button');
        resolveBtn.textContent = 'Resolve';
        resolveBtn.className = 'btn btn-success btn-sm';
        resolveBtn.addEventListener('click', () => {
            updateSOSStatus(id, 'resolved');
        });
        actionDiv.appendChild(resolveBtn);
    }
    
    // Set row content
    row.innerHTML = `
        <td>${id.substring(0, 8)}...</td>
        <td>${userName}</td>
        <td>${timestamp}</td>
        <td>${sosAlert.address || 'Location not available'}</td>
        <td></td>
        <td></td>
        <td></td>
    `;
    
    // Add status badge to the status cell
    row.cells[4].appendChild(statusBadge);
    
    // Add location badge to the location cell
    row.cells[5].appendChild(locationBadge);
    
    // Add action buttons to the action cell
    row.cells[6].appendChild(actionDiv);
    
    // Highlight emergency rows
    if (sosAlert.status === 'active') {
        row.classList.add('emergency-row');
    }
    
    console.log('Created SOS row:', id, sosAlert);
    return row;
}

// Show SOS alert details in modal
function showSOSDetails(sosId) {
    currentSOSId = sosId;
    
    // Find the SOS alert in the array
    const sosAlert = allSOSAlerts.find(alert => alert.id === sosId);
    
    if (!sosAlert) {
        console.error(`SOS alert with ID ${sosId} not found`);
        return;
    }
    
    console.log('Showing SOS details for:', sosId, sosAlert);
    
    // Format timestamp
    let timestamp = 'N/A';
    if (sosAlert.timestamp) {
        if (sosAlert.timestamp.toDate) {
            timestamp = new Date(sosAlert.timestamp.toDate()).toLocaleString();
        } else if (sosAlert.timestamp.seconds) {
            timestamp = new Date(sosAlert.timestamp.seconds * 1000).toLocaleString();
        } else if (typeof sosAlert.timestamp === 'string') {
            timestamp = sosAlert.timestamp; // Use the string timestamp directly
        } else {
            timestamp = new Date(sosAlert.timestamp).toLocaleString();
        }
    }
    
    // Build details HTML
    let detailsHTML = `
        <div class="detail-item">
            <strong>Alert ID:</strong> ${sosId}
        </div>
        <div class="detail-item">
            <strong>User:</strong> ${sosAlert.userName || sosAlert.userId || 'Unknown'}
        </div>
        <div class="detail-item">
            <strong>User ID:</strong> ${sosAlert.userId || 'Unknown'}
        </div>
        <div class="detail-item">
            <strong>Time:</strong> ${timestamp}
        </div>
        <div class="detail-item">
            <strong>Status:</strong> ${sosAlert.status || 'active'}
        </div>
        <div class="detail-item">
            <strong>Device Info:</strong> ${sosAlert.deviceInfo || 'Not available'}
        </div>
        <div class="detail-item">
            <strong>Type:</strong> ${sosAlert.type || 'Standard SOS'}
        </div>
    `;
    
    // Add location information if available
    const hasLocation = sosAlert.hasLocation === true || (sosAlert.latitude && sosAlert.longitude);
    if (hasLocation) {
        detailsHTML += `
            <div class="detail-item">
                <strong>Location:</strong> ${sosAlert.address || 'Address not available'}
            </div>
            <div class="detail-item">
                <strong>Coordinates:</strong> ${sosAlert.latitude || 'N/A'}, ${sosAlert.longitude || 'N/A'}
            </div>
            <div class="detail-item map-container">
                <strong>Map:</strong><br>
                <a href="https://www.google.com/maps?q=${sosAlert.latitude},${sosAlert.longitude}" target="_blank" class="btn btn-sm btn-info">Open in Google Maps</a>
            </div>
        `;
    } else {
        detailsHTML += `
            <div class="detail-item">
                <strong>Location:</strong> Location data not available
            </div>
        `;
    }
    
    // Add notes if available
    if (sosAlert.notes) {
        detailsHTML += `
            <div class="detail-item">
                <strong>Notes:</strong> ${sosAlert.notes}
            </div>
        `;
    }
    
    // Set the details content
    sosDetailsContent.innerHTML = detailsHTML;
    
    // Show/hide buttons based on status
    if (sosAlert.status === 'active') {
        resolveButton.style.display = 'block';
    } else {
        resolveButton.style.display = 'none';
    }
    
    // Set up resolve button event listener
    resolveButton.onclick = () => {
        updateSOSStatus(sosId, 'resolved');
    };
    
    // Set up contact button event listener
    contactButton.onclick = () => {
        // Implement contact functionality (e.g., show contact options)
        alert(`Contact information for ${sosAlert.userName || 'user'}: ${sosAlert.userPhone || 'Phone not available'}`);
    };
    
    // Display the modal
    sosModal.style.display = 'block';
}

// Update SOS alert status
function updateSOSStatus(sosId, status) {
    const sosRef = doc(db, "sosAlerts", sosId);
    
    // Show loading indicator
    sosLoadingIndicator.style.display = 'flex';
    
    updateDoc(sosRef, {
        status: status,
        resolvedAt: new Date()
    })
        .then(() => {
            console.log(`SOS alert ${sosId} status updated to ${status}`);
            // Close modal if it's open
            sosModal.style.display = 'none';
            // Refresh SOS alerts list
            setupSOSListener();
            // Show success message
            alert(`SOS alert marked as ${status} successfully`);
        })
        .catch((error) => {
            console.error("Error updating SOS alert status: ", error);
            alert(`Error updating status: ${error.message}`);
            sosLoadingIndicator.style.display = 'none';
        });
}

// Init function updated to hide admin management initially
function init() {
    // Set default tab to requests
    requestsTab.classList.add('active');
    sosTab.classList.remove('active');
    requestsSection.style.display = 'block';
    sosSection.style.display = 'none';
    
    // Show Help Requests stats, hide SOS stats
    document.getElementById('help-requests-stats').style.display = 'grid';
    document.getElementById('sos-alerts-stats').style.display = 'none';
    
    // Hide admin management section initially
    document.getElementById('admin-management').style.display = 'none';
    
    // Show loading indicator
    showLoading(true);
    
    // Set up both listeners to load data
    setupFirestoreListener();
    setupSOSListener();
    
    console.log('Admin panel initialized');
}

// Start the app
init();
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