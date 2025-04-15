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
    orderBy 
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
const pendingCount = document.getElementById('pendingCount');
const acceptedCount = document.getElementById('acceptedCount');
const rejectedCount = document.getElementById('rejectedCount');
const totalCount = document.getElementById('totalCount');

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
    
    let q = collection(db, "requests");
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
        <td>${request.userId || 'N/A'}</td>
        <td>${request.itemNeeded || 'N/A'}</td>
        <td>${request.serviceType || 'N/A'}</td>
        <td>${timestamp}</td>
        <td>${request.location?.address || 'N/A'}</td>
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
            <div class="detail-label">Service Type:</div>
            <div class="detail-value">${request.serviceType || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Item Needed:</div>
            <div class="detail-value">${request.itemNeeded || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Emergency:</div>
            <div class="detail-value">${request.isEmergency ? 'Yes' : 'No'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Time Requested:</div>
            <div class="detail-value">${formattedDate} ${formattedTime}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Location:</div>
            <div class="detail-value">${request.location?.address || 'N/A'}</div>
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
        const requestRef = doc(db, "requests", requestId);
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

// Initialize the app
function init() {
    // Hide admin content initially
    adminContent.style.display = 'none';
    
    // Ensure loading indicator is hidden initially
    loadingIndicator.style.display = 'none';
}

// Start the app
init(); 