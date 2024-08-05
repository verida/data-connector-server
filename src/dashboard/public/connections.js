$(document).ready(function() {
    // Load the private key from local storage
    const savedVeridaKey = localStorage.getItem('veridaKey');
    if (savedVeridaKey) {
        $('#veridaKey').val(savedVeridaKey);
    }

    $('#loadBtn').click(function() {
        const veridaKey = $('#veridaKey').val();
        
        if (!veridaKey) {
            alert('Please enter a Verida Private Key.');
            return;
        }

        // Save the private key in local storage
        localStorage.setItem('veridaKey', veridaKey);

        // Show the loading indicator
        $('#loadingIndicator').show();

        // Clear existing table rows
        $('#providerTable').empty();

        // Fetch data from the /api/v1/providers endpoint
        $.getJSON('https://127.0.0.1:5021/api/v1/providers', function(providersResponse) {
            const providersData = providersResponse;

            // Fetch data from the /api/v1/syncStatus endpoint, appending the veridaKey
            $.getJSON(`https://127.0.0.1:5021/api/v1/syncStatus?key=${veridaKey}`, function(syncStatusResponse) {
                const syncData = syncStatusResponse.result;

                const processedProviders = new Set();

                // Loop through all sync status connections
                $.each(syncData, function(key, value) {
                    const connection = value.connection;
                    const handlers = value.handlers;
                    const providerDetails = providersData[connection.provider];

                    if (connection.provider === 'mock') {
                        return; // Skip the "mock" provider
                    }

                    processedProviders.add(connection.provider);

                    let handlerInfo = '';
                    handlers.forEach(handler => {
                        handlerInfo += `<li>${handler.handlerName} (Status: ${handler.status})</li>`;
                    });

                    const row = `
                        <tr>
                            <td><img src="${providerDetails.icon}" alt="${providerDetails.name}" style="width: 30px; height: 30px;"> ${providerDetails.label}</td>
                            <td>${connection.profile.name}</td>
                            <td>${connection.syncStatus}</td>
                            <td><ul>${handlerInfo}</ul></td>
                            <td>
                                ${handlers.length === 0 ? `<button class="btn btn-primary connect-btn" data-provider="${connection.provider}" data-provider-id="${connection.providerId}">Connect</button>` : ''}
                                <button class="btn btn-success sync-btn" data-provider="${connection.provider}" data-provider-id="${connection.providerId}">Sync</button>
                            </td>
                        </tr>
                    `;
                    $('#providerTable').append(row);
                });

                // Add remaining providers not included in syncStatus or with no handlers
                $.each(providersData, function(providerName, providerDetails) {
                    if (providerName === 'mock') {
                        return; // Skip the "mock" provider
                    }

                    // Only add the provider if it hasn't been fully processed (all connections accounted for)
                    if (!processedProviders.has(providerName)) {
                        const row = `
                            <tr>
                                <td><img src="${providerDetails.icon}" alt="${providerDetails.name}" style="width: 30px; height: 30px;"> ${providerDetails.label}</td>
                                <td>N/A</td>
                                <td>Not Connected</td>
                                <td>N/A</td>
                                <td>
                                    <button class="btn btn-primary connect-btn" data-provider="${providerName}">Connect</button>
                                </td>
                            </tr>
                        `;
                        $('#providerTable').append(row);
                    } else {
                        // For providers that have connections, still add an option to connect
                        const row = `
                            <tr>
                                <td><img src="${providerDetails.icon}" alt="${providerDetails.name}" style="width: 30px; height: 30px;"> ${providerDetails.label}</td>
                                <td>N/A</td>
                                <td>Already Connected</td>
                                <td>N/A</td>
                                <td>
                                    <button class="btn btn-primary connect-btn" data-provider="${providerName}">Connect Another</button>
                                </td>
                            </tr>
                        `;
                        $('#providerTable').append(row);
                    }
                });

                // Hide the loading indicator
                $('#loadingIndicator').hide();

                // Add event listeners for the buttons
                $('.connect-btn').click(function() {
                    const providerName = $(this).data('provider');
                    const url = `/api/v1/connect/${providerName}?key=${veridaKey}`;
                    window.open(url, '_blank');
                });

                $('.sync-btn').click(function() {
                    const provider = $(this).data('provider');
                    const providerId = $(this).data('provider-id');
                    alert(`Syncing with ${provider} (ID: ${providerId || 'N/A'}) with Verida Key: ${veridaKey}`);
                    // Add your sync logic here using the veridaKey if needed
                });
            }).fail(function() {
                alert('Failed to fetch sync status data.');
                // Hide the loading indicator
                $('#loadingIndicator').hide();
            });
        }).fail(function() {
            alert('Failed to fetch provider data.');
            // Hide the loading indicator
            $('#loadingIndicator').hide();
        });
    });
});
