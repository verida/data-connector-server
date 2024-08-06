$(document).ready(function() {
    // Load the private key from local storage
    const savedVeridaKey = localStorage.getItem('veridaKey');
    $('#veridaKey').val(savedVeridaKey);
    handleButtonStates();

    // Load providers on page load for the dropdown and fetch connections if a key is saved
    loadProviders(() => {
        if (savedVeridaKey) {
            loadProvidersAndConnections(savedVeridaKey);
        }
    });

    $('#veridaKey').on('input', handleButtonStates);

    function handleButtonStates() {
        const veridaKey = $('#veridaKey').val().trim();
        $('#loadBtn').prop('disabled', !veridaKey);
        $('#generateIdentityBtn').toggle(!veridaKey);
        $('#clearBtn').toggle(!!veridaKey);
    }

    $('#loadBtn').click(function() {
        const veridaKey = $('#veridaKey').val().trim();
        if (!veridaKey) {
            alert('Please enter a Verida Private Key.');
            return;
        }

        // Save the private key in local storage
        localStorage.setItem('veridaKey', veridaKey);

        // Clear existing table rows
        $('#providerTable').empty();

        // Fetch and display connections
        loadProvidersAndConnections(veridaKey);
    });

    $('#clearBtn').click(function() {
        $('#veridaKey').val('');
        localStorage.removeItem('veridaKey');
        $('#providerTable').empty();
        handleButtonStates();
    });

    $('#generateIdentityBtn').click(function() {
        alert("Generating a new identity...");
        // Implement identity generation logic here
    });

    function loadProvidersAndConnections(veridaKey) {
        // Show the loading indicator
        $('#loadingIndicator').show();
        $('#loadBtn').prop('disabled', true);

        $.getJSON(`/api/v1/syncStatus?key=${veridaKey}`, function(syncStatusResponse) {
            $.each(syncStatusResponse.result, function(key, value) {
                const connection = value.connection;
                const handlers = value.handlers;

                const formattedSyncTimes = `Start: ${new Date(connection.syncStart).toLocaleString()}, End: ${new Date(connection.syncEnd).toLocaleString()}`;

                const providerDetails = getProviderDetails(connection.provider);

                const row = $(`
                    <tr>
                        <td><img src="${providerDetails.icon}" alt="${providerDetails.label}" style="width: 30px; height: 30px;"> ${providerDetails.label}</td>
                        <td>${connection.profile.name}</td>
                        <td>${connection.syncStatus}<br>${formattedSyncTimes}</td>
                        <td><ul>${handlers.map(handler => `<li>${handler.handlerName} (Status: ${handler.status})</li>`).join('')}</ul></td>
                        <td>
                            <button class="btn btn-success sync-btn" data-provider="${connection.provider}" data-provider-id="${connection.providerId}">Sync Now</button>
                            <button class="btn btn-secondary logs-btn" data-provider="${connection.provider}" data-provider-id="${connection.providerId}">Full Logs</button>
                            <button class="btn btn-danger disconnect-btn" data-provider="${connection.provider}" data-provider-id="${connection.providerId}">Disconnect</button>
                        </td>
                    </tr>
                `);
                $('#providerTable').append(row);
            });

            $('.logs-btn').click(function() {
                const provider = $(this).data('provider');
                const providerId = $(this).data('provider-id');
                window.open(`/dashboard/data?limit=50&filter=providerName:${provider},providerId:${providerId}&schema=https://vault.schemas.verida.io/data-connections/activity-log/v0.1.0/schema.json&sort=insertedAt:desc`, '_blank');
            });

            $('.disconnect-btn').click(function() {
                const provider = $(this).data('provider');
                const providerId = $(this).data('provider-id');
                $.getJSON(`/api/v1/disconnect/${provider}?key=${veridaKey}&providerId=${providerId}`, function(response) {
                    console.log(response.data)
                })
            });

            $('.sync-btn').click(function() {
                const $button = $(this)
                const provider = $(this).data('provider');
                const providerId = $(this).data('provider-id');
                $button.text('Syncing...')
                $button.prop('disabled', true);

                // Start tailing logs
                const eventSource = new EventSource(`/api/v1/logs?key=${veridaKey}`);

                function addEventRow(eventData) {
                    const tableBody = $('#eventTableBody');
                    const rowHtml = `
                      <tr>
                        <td>${eventData.level}</td>
                        <td>${eventData.insertedAt}</td>
                        <td>${eventData.providerName}</td>
                        <td>${eventData.providerId}</td>
                        <td>${eventData.message}</td>
                      </tr>
                    `;
                    tableBody.append(rowHtml);
                  }

                eventSource.addEventListener('message', (item) => {
                    const record = JSON.parse(item.data)
                    addEventRow(record)
                })

                // Display log modal
                $('#eventLogModal').modal('show');

                // Handle modal closing
                $('#eventLogModal').on('hidden.bs.modal', function (e) {
                    eventSource.close()
                  });

                // Initialize sync
                $.getJSON(`/api/v1/sync?key=${veridaKey}&provider=${provider}&providerId=${providerId}`, function(response) {
                    $button.prop('disabled', false);
                    $button.text('Sync Now')

                    setTimeout(() => {
                        eventSource.close()
                    }, 5000)
                })
            });

            $('#loadingIndicator').hide(); // Hide the loading indicator
            $('#loadBtn').prop('disabled', false);
        });
    }

    function loadProviders(callback) {
        $.getJSON('/api/v1/providers', function(providersResponse) {
            window.providersData = providersResponse; // Store globally or manage differently as needed
            populateConnectionDropdown(providersResponse);
            if (callback) callback();
        });
    }

    function populateConnectionDropdown(providersData) {
        const $dropdown = $('#providerListDropdown');
        $dropdown.empty();
        $.each(providersData, function(key, provider) {
            if (provider.name === 'mock') return; // Skip 'mock' provider
            $dropdown.append(`<a class="dropdown-item" href="#" onclick="window.open('/api/v1/connect/${provider.name}?key=${$('#veridaKey').val()}', '_blank');">
                <img src="${provider.icon}" alt="${provider.label}" style="width: 20px; height: 20px; margin-right: 5px;">
                ${provider.label}
            </a>`);
        });
    }

    function getProviderDetails(providerName) {
        return window.providersData[providerName] || { icon: 'default-icon.png', label: 'Unknown' };
    }
});
