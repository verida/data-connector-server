$(document).ready(function() {
    // Load the private key from local storage
    let savedVeridaKey = localStorage.getItem('veridaKey');
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
        savedVeridaKey = veridaKey
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

        $.getJSON(`/api/v1/sync/status?key=${veridaKey}`, function(syncStatusResponse) {
            $.each(syncStatusResponse.result, function(key, value) {
                const connection = value.connection;
                const handlers = value.handlers;

                const formattedSyncTimes = `Start: ${new Date(connection.syncStart).toLocaleString()}<br>End: ${new Date(connection.syncEnd).toLocaleString()}`;

                const providerDetails = getProviderDetails(connection.provider);
                const avatar = connection.profile.avatar.uri ? `<img src="${connection.profile.avatar.uri}" alt="${connection.profile.name}" style="width: 30px; height: 30px;"></img>` : ''

                const row = $(`
                    <tr>
                        <td>
                            <img src="${providerDetails.icon}" alt="${providerDetails.label}" style="width: 30px; height: 30px;">
                            ${providerDetails.label}</td>
                        <td>
                            ${avatar}
                            <strong>${connection.profile.name}</strong><br />${connection.profile.email ? '('+ connection.profile.email +')' : ''} (${connection.providerId})</td>
                        <td>${connection.syncStatus}<br>${formattedSyncTimes}</td>
                        <td>${handlers.map(handler => `[${handler.handlerName}] ${handler.syncMessage ? handler.syncMessage : ""} (${handler.status})<br/>`).join('')}</td>
                        <td>
                            <div class="btn-group">
                                <button type="button" class="btn btn-success sync-btn" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" data-provider="${connection.provider}" data-provider-id="${connection.providerId}">
                                    Sync Now
                                    <button type="button" class="btn btn-success dropdown-toggle dropdown-toggle-split" data-toggle="dropdown" aria-expanded="false">
                                        <span class="sr-only">Toggle Dropdown</span>
                                    </button>
                                </button>
                                <div class="dropdown-menu">
                                    <a class="dropdown-item sync-btn" href="#" data-sync-type="force" data-provider="${connection.provider}" data-provider-id="${connection.providerId}">Force</a>
                                </div>
                            </div>
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
                window.open(`/developer/data?limit=50&filter=providerName:${provider},providerId:${providerId}&schema=https://vault.schemas.verida.io/data-connections/activity-log/v0.1.0/schema.json&sort=insertedAt:desc`, '_blank');
            });

            $('.disconnect-btn').click(function() {
                const provider = $(this).data('provider');
                const providerId = $(this).data('provider-id');
                $.getJSON(`/api/v1/provider/disconnect/${provider}?key=${veridaKey}&providerId=${providerId}`, function(response) {
                    console.log(response.data)
                })
            });

            $('.sync-btn').click(function() {
                const $button = $(this)
                const provider = $(this).data('provider');
                const providerId = $(this).data('provider-id');
                $button.text('Syncing...')
                $button.prop('disabled', true);
                const syncType = $(this).data('sync-type');

                // Start tailing logs
                const eventSource = new EventSource(`/api/v1/sync/logs?key=${veridaKey}`);

                const tableBody = $('#eventTableBody');
                tableBody.empty()

                function addEventRow(eventData) {
                    const rowHtml = `
                      <tr>
                        <td>${eventData.level}</td>
                        <td>${eventData.insertedAt}</td>
                        <td>${eventData.providerName} ${eventData.handlerName ? "(" + eventData.handlerName + ")" : ""}</td>
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
                $.getJSON(`/api/v1/sync?key=${veridaKey}&provider=${provider}&providerId=${providerId}&${syncType == 'force' ? 'force=true' : ''}`, function(response) {
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
            window.providersData = {}
            for (const provider of providersResponse) {
                window.providersData[provider.name] = provider
            }
            populateConnectionDropdown(providersResponse);
            if (callback) callback();
        });
    }

    function populateConnectionDropdown(providersData) {
        const $dropdown = $('#providerListDropdown');
        $dropdown.empty();
        $.each(providersData, function(key, provider) {
            if (provider.name === 'mock') return; // Skip 'mock' provider
            $dropdown.append(`<a class="dropdown-item" href="#" onclick="window.open('/api/v1/provider/connect/${provider.name}?key=${$('#veridaKey').val()}', '_blank');">
                <img src="${provider.icon}" alt="${provider.label}" style="width: 20px; height: 20px; margin-right: 5px;">
                ${provider.label}
            </a>`);
        });
    }

    function getProviderDetails(providerName) {
        return window.providersData[providerName] || { icon: 'default-icon.png', label: 'Unknown' };
    }
});
