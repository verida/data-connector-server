const SYNC_LOG_SCHEMA = `https://vault.schemas.verida.io/data-connections/activity-log/v0.2.0/schema.json`

$(document).ready(function() {
    // Load the private key from local storage
    const veridaKey = localStorage.getItem('veridaKey');

    // Load providers on page load for the dropdown and fetch connections if a key is saved
    loadProviders(() => {
        if (veridaKey) {
            loadProvidersAndConnections();
        }
    });

    $('#eventLogModal').on('hidden.bs.modal', function (e) {
        loadProvidersAndConnections()
      });

    $('#loadBtn').click(function() {
        // Fetch and display connections
        loadProvidersAndConnections();
    });

    function loadProvidersAndConnections() {
        // Clear existing table rows
        $('#providerTable').empty();

        // Show the loading indicator
        $('#loadingIndicator').show();
        $('#loadBtn').prop('disabled', true);

        $.ajax({
            url: `/api/rest/v1/connections?key=${veridaKey}`,
            type: 'GET',
            contentType: 'application/json',
            success: function(syncStatusResponse) {
                $.each(syncStatusResponse.items, function(key, value) {
                    const connection = value;
                    const handlers = value.handlers;

                    const formattedSyncTimes = `Start: ${new Date(connection.syncStart).toLocaleString()}<br>End: ${new Date(connection.syncEnd).toLocaleString()}`;

                    const providerDetails = getProviderDetails(connection.providerId);
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
                            <td>${handlers.map(handler => `[${handler.id}] ${handler.syncMessage ? handler.syncMessage : ""} (${handler.status})<br/>`).join('')}</td>
                            <td>
                                <div class="btn-group">
                                    <button type="button" class="btn btn-success sync-btn" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" data-connection="${connection._id}">
                                        Sync Now
                                        <button type="button" class="btn btn-success dropdown-toggle dropdown-toggle-split" data-toggle="dropdown" aria-expanded="false">
                                            <span class="sr-only">Toggle Dropdown</span>
                                        </button>
                                    </button>
                                    <div class="dropdown-menu">
                                        <a class="dropdown-item sync-btn" href="#" data-sync-type="force"  data-connection="${connection._id}">Force</a>
                                    </div>
                                </div>
                                <button class="btn btn-secondary logs-btn" data-provider="${connection.providerId}" data-provider-id="${connection.accountId}">Full Logs</button>
                                <button class="btn btn-danger disconnect-btn" data-connection="${connection._id}">Disconnect</button>
                            </td>
                        </tr>
                    `);
                    $('#providerTable').append(row);
                });

                $('.logs-btn').click(function() {
                    const provider = $(this).data('provider');
                    const providerId = $(this).data('provider-id');
                    window.open(`/developer/data?limit=50&filter=providerId:${provider},accountId:${providerId}&schema=${SYNC_LOG_SCHEMA}&sort=insertedAt:desc`, '_blank');
                });

                $('.disconnect-btn').click(function() {
                    const connectionId = $(this).data('connection');
                    $.ajax({
                        url: `/api/rest/v1/connections/${connectionId}?key=${veridaKey}`,
                        type: 'DELETE',
                        success: function(response) {
                        }
                    })
                });

                $('.sync-btn').click(function() {
                    const $button = $(this)
                    const connectionId = $(this).data('connection');
                    $button.text('Syncing...')
                    $button.prop('disabled', true);
                    const syncType = $(this).data('sync-type');

                    // Start tailing logs
                    const eventSource = new EventSource(`/api/rest/v1/ds/watch/${btoa(SYNC_LOG_SCHEMA)}?key=${veridaKey}`);

                    const tableBody = $('#eventTableBody');
                    tableBody.empty()

                    function addEventRow(eventResponse) {
                        const eventData = eventResponse.value
                        const rowHtml = `
                          <tr>
                            <td>${eventData.level}</td>
                            <td>${eventData.insertedAt}</td>
                            <td>${eventData.providerId} ${eventData.handlerId ? "(" + eventData.handlerId + ")" : ""}</td>
                            <td>${eventData.accountId}</td>
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
                    $.ajax({
                        url: `/api/rest/v1/connections/${connectionId}/sync?key=${veridaKey}`,
                        type: 'POST',
                        data: JSON.stringify({
                            forceSync: (syncType == 'force')
                        }),
                        contentType: 'application/json',
                        success: function(response) {
                            $button.prop('disabled', false);
                            $button.text('Sync Now')

                            setTimeout(() => {
                                eventSource.close()
                            }, 5000)
                        }
                    })
                });

                $('#loadingIndicator').hide(); // Hide the loading indicator
                $('#loadBtn').prop('disabled', false);
            },
            error: function(response) {
                const errorMessage = response.responseJSON.error
                $('#loadingIndicator').hide()
                $('#errorIndicator').html(`<strong>Error:</strong> ${errorMessage}`)
                $('#errorIndicator').show()
                setTimeout(() => {
                    $('#errorIndicator').hide()
                }, 5000)
            }
        })
    }

    function loadProviders(callback) {
        $.getJSON('/api/rest/v1/providers', function(providersResponse) {
            window.providersData = {}
            for (const provider of providersResponse.items) {
                window.providersData[provider.id] = provider
            }
            populateConnectionDropdown(providersResponse.items);
            if (callback) callback();
        });
    }

    function populateConnectionDropdown(providersData) {
        const $dropdown = $('#providerListDropdown');
        $dropdown.empty();
        $.each(providersData, function(key, provider) {
            if (provider.id === 'mock') {
                return; // Skip 'mock' provider
            }

            if (provider.status === 'active') {
                $dropdown.append(`
                    <a class="dropdown-item" href="#" onclick="window.open('/providers/${provider.id}/connect?key=${veridaKey}', '_blank');">
                        <img src="${provider.icon}" alt="${provider.label}" style="width: 20px; height: 20px; margin-right: 5px;">
                    ${provider.label}
                    </a>`
                );
            }
            if (provider.status === 'upcoming') {
                $dropdown.append(`
                    <div class="dropdown-item">
                        <img src="${provider.icon}" alt="${provider.label}" style="width: 20px; height: 20px; margin-right: 5px;">
                    ${provider.label} (Upcoming)
                    </div>`
                );
            }

        });
    }

    function getProviderDetails(providerId) {
        return window.providersData[providerId] || { icon: 'default-icon.png', label: 'Unknown' };
    }
});
