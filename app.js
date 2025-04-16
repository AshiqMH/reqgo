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
    getDoc,
    addDoc,
    setDoc,
    limit,
    deleteDoc
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
                .then(async (docSnapshot) => {
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
                        // User document doesn't exist, check for temporary admin document
                        console.log("Checking for temporary admin document");
                        
                        // Look for temporary document with this email
                        const tempId = `temp_${email.replace(/[.@]/g, '_')}`;
                        const tempDocRef = doc(db, "users", tempId);
                        const tempDocSnapshot = await getDoc(tempDocRef);
                        
                        if (tempDocSnapshot.exists() && tempDocSnapshot.data().role === "admin") {
                            // Found temporary admin, copy to permanent document with correct UID
                            console.log("Found temporary admin document, migrating to permanent UID");
                            
                            const tempData = tempDocSnapshot.data();
                            
                            // Create permanent document with correct UID
                            await setDoc(userDocRef, {
                                ...tempData,
                                isTemporary: false,
                                updatedAt: new Date()
                            });
                            
                            // Delete temporary document
                            await deleteDoc(tempDocRef);
                            
                            console.log("Admin document migrated successfully");
                            // Auth state change listener will handle the rest
                        } else {
                            // User is not an admin, sign them out
                            signOut(auth).then(() => {
                                loginError.textContent = "User profile not found. Please contact support.";
                            });
                        }
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
    
    // Format status with notification indicator
    let statusHtml = `<span class="status-badge status-${request.status}">${request.status}</span>`;
    if (request.status !== 'pending' && request.notificationSent) {
        statusHtml += `<span class="notification-sent">Notification sent</span>`;
    }
    
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
            <div class="detail-value">${statusHtml}</div>
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
        console.log(`Starting to update request: ${requestId} to status: ${status}`);
        
        // Get the request data first to get user information
        const requestRef = doc(db, "help_requests", requestId);
        const requestSnapshot = await getDoc(requestRef);
        
        if (!requestSnapshot.exists()) {
            alert("Request not found");
            return;
        }
        
        const requestData = requestSnapshot.data();
        const userEmail = requestData.userEmail;
        const userId = requestData.userId;
        
        console.log(`Request data found - UserID: ${userId}, Email: ${userEmail}`);
        
        // Update status in Firestore
        await updateDoc(requestRef, {
            status: status,
            updatedAt: new Date(),
            notificationSent: true
        });
        
        console.log(`Request ${requestId} status updated to ${status}`);
        
        // Get user's document to check for FCM token
        if (userId) {
            try {
                console.log(`Checking for user document: ${userId}`);
                const userRef = doc(db, "users", userId);
                const userSnapshot = await getDoc(userRef);
                
                if (userSnapshot.exists()) {
                    console.log(`User document exists. Has FCM token: ${!!userSnapshot.data().fcmToken}`);
                    
                    const fcmToken = userSnapshot.data().fcmToken;
                    
                    // Create a notification record
                    const notificationsRef = collection(db, "notifications");
                    const newNotification = {
                        userId: userId,
                        userEmail: userEmail,
                        requestId: requestId,
                        status: status,
                        message: `Your roadside assistance request has been ${status}`,
                        timestamp: new Date(),
                        read: false
                    };
                    
                    // Add FCM token if available
                    if (fcmToken) {
                        newNotification.fcmToken = fcmToken;
                    }
                    
                    const notificationRef = await addDoc(notificationsRef, newNotification);
                    console.log(`Notification created with ID: ${notificationRef.id}`);
                } else {
                    console.log(`No user document found for ID: ${userId}`);
                }
            } catch (error) {
                console.error("Error sending notification:", error);
                // Continue with the status update even if notification fails
            }
        } else {
            console.warn("No userId found in the request data. Cannot send notification.");
        }
        
        // Close modal
        requestDetailsModal.style.display = 'none';
        
        // Show success message
        alert(`Request ${status} successfully. User will be notified.`);
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
    // Hide admin content and admin management initially
    adminContent.style.display = 'none';
    
    // Ensure loading indicator is hidden initially
    loadingIndicator.style.display = 'none';
}

// Start the app
init();

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
        // First, check if the user exists in Firebase Authentication
        // Since we can't directly query Auth from client side, we'll look for existing Firestore documents
        // that might have the user's info
        
        // Check for existing user documents with this email
        showAdminStatus(`Checking for user: ${userEmail}...`, null);
        
        // Try to find any user document with this email (in users collection)
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", userEmail));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            // Next, try to find a document in notifications or help_requests that might have the user's ID
            showAdminStatus(`Searching for user UID across multiple collections...`, null);
            
            let foundUserId = null;
            
            // Check notifications collection
            const notificationsRef = collection(db, "notifications");
            const notificationsQuery = query(notificationsRef, where("userEmail", "==", userEmail), limit(1));
            const notificationsSnapshot = await getDocs(notificationsQuery);
            
            if (!notificationsSnapshot.empty) {
                foundUserId = notificationsSnapshot.docs[0].data().userId;
                showAdminStatus(`Found user ID in notifications: ${foundUserId}`, null);
            } else {
                // Check help_requests collection
                const requestsRef = collection(db, "help_requests");
                const requestsQuery = query(requestsRef, where("userEmail", "==", userEmail), limit(1));
                const requestsSnapshot = await getDocs(requestsQuery);
                
                if (!requestsSnapshot.empty) {
                    foundUserId = requestsSnapshot.docs[0].data().userId;
                    showAdminStatus(`Found user ID in help requests: ${foundUserId}`, null);
                }
            }
            
            if (foundUserId) {
                // We found the user ID, now create a user document with it
                const newUserData = {
                    email: userEmail,
                    role: "admin",
                    name: "",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isVerified: false
                };
                
                const userRef = doc(db, "users", foundUserId);
                await setDoc(userRef, newUserData);
                
                showAdminStatus(`User ${userEmail} was added as admin with the correct UID!`, true);
                userEmailInput.value = '';
                return;
            }
            
            // If we still haven't found the user, create a temporary document
            showAdminStatus(`Creating temporary document. User may need to sign in once more to fully enable admin privileges.`, null);
            
            // Create new user document with admin role
            const newUserData = {
                email: userEmail,
                role: "admin",
                name: "",
                createdAt: new Date(),
                updatedAt: new Date(),
                isVerified: false,
                isTemporary: true  // Mark as temporary
            };
            
            // Use email as document ID but in a format that won't conflict with actual UIDs
            const safeId = `temp_${userEmail.replace(/[.@]/g, '_')}`;
            const userRef = doc(db, "users", safeId);
            
            await setDoc(userRef, newUserData);
            
            showAdminStatus(`Temporary admin document created for ${userEmail}. Admin privileges will be enabled when they next sign in.`, true);
            
            // Clear form
            userEmailInput.value = '';
            return;
        }
        
        // User document exists, check if it's already an admin
        const userDoc = querySnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();
        
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
        
        showAdminStatus(`User ${userEmail} has been set as an admin successfully!`, true);
        userEmailInput.value = '';
    } catch (error) {
        console.error("Error setting user as admin:", error);
        showAdminStatus(`Error: ${error.message}`, false);
    }
});

// Show admin status message
function showAdminStatus(message, isSuccess) {
    adminStatus.innerHTML = message; // Use innerHTML to allow line breaks
    
    // Reset classes
    adminStatus.classList.remove('success', 'error');
    
    if (isSuccess === true) {
        adminStatus.classList.add('success');
    } else if (isSuccess === false) {
        adminStatus.classList.add('error');
    }
    
    // Add some styling for better readability of long messages
    if (message && message.length > 50) {
        adminStatus.style.whiteSpace = 'pre-line';
        adminStatus.style.lineHeight = '1.5';
        adminStatus.style.padding = '10px';
        
        // Replace the exclamation mark and "IMPORTANT" with breaks for readability
        adminStatus.innerHTML = adminStatus.innerHTML
            .replace('! IMPORTANT:', '!<br><br><strong>IMPORTANT:</strong><br>');
    } else {
        adminStatus.style.whiteSpace = 'normal';
        adminStatus.style.padding = '5px';
    }
} 
