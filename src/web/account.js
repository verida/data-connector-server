document.addEventListener("DOMContentLoaded", function () {
    // Function to load the private key from local storage
    const privateKey = localStorage.getItem('veridaKey');

    if (privateKey) {
        // Make GET request to load account details
        fetch(`/api/rest/v1/account/fromKey?key=${privateKey}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => {
            if (response.ok) {
                return response.json();  // Parse the JSON if response is successful
            } else {
                window.location.href = '/login';
            }
        })
        .then(data => {
            // Assuming data contains user info as specified in the earlier response format
            const userName = data.account.name || '';
            const avatarUrl = data.account.avatar?.uri || '';

            const avatarHTML = avatarUrl ? `<img src="${avatarUrl}" alt="${userName}" class="rounded-circle" style="width: 30px; height: 30px;">` : ``

            // Inject user info into the Bootstrap navigation bar
            const navbar = document.querySelector('#navbarNav');
            if (navbar) {
                navbar.innerHTML += `
                <ul class="navbar-nav ml-auto">
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            ${avatarHTML} ${userName}
                        </a>
                        <div class="dropdown-menu dropdown-menu-right" aria-labelledby="navbarDropdown">
                            <a class="dropdown-item" href="#" id="logoutButton">Logout</a>
                        </div>
                    </li>
                </ul>
                `;
            }

            // Handle logout functionality
            document.getElementById('logoutButton').addEventListener('click', function () {
                // Clear local storage
                localStorage.removeItem('veridaKey');
                
                // Redirect to the login page
                window.location.href = '/login';
            });
        })
        .catch(error => {
            console.error('Error:', error);
            // Optionally handle errors (e.g., redirect to login if session is invalid)
        });
    } else {
        // Redirect to login if no private key is found in local storage
        window.location.href = '/login';
    }
});
