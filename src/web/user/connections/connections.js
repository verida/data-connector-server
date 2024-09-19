const SYNC_LOG_SCHEMA = `https://vault.schemas.verida.io/data-connections/activity-log/v0.1.0/schema.json`

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

        $.ajax({
            url: `/api/rest/v1/connections?key=${veridaKey}`,
            type: 'GET',
            contentType: 'application/json',
            success: function(syncStatusResponse) {
                $.each(syncStatusResponse.items, function(key, value) {
                    const connection = value;
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
                                <button class="btn btn-secondary logs-btn" data-provider="${connection.provider}" data-provider-id="${connection.providerId}">Full Logs</button>
                                <button class="btn btn-danger disconnect-btn" data-connection="${connection._id}">Disconnect</button>
                            </td>
                        </tr>
                    `);
                    $('#providerTable').append(row);
                });
    
                $('.logs-btn').click(function() {
                    const provider = $(this).data('provider');
                    const providerId = $(this).data('provider-id');
                    window.open(`/developer/data?limit=50&filter=providerName:${provider},providerId:${providerId}&schema=${SYNC_LOG_SCHEMA}&sort=insertedAt:desc`, '_blank');
                });
    
                $('.disconnect-btn').click(function() {
                    const connectionId = $(this).data('connection');
                    $.ajax({
                        url: `/api/rest/v1/connections/${connectionId}?key=${veridaKey}`,
                        type: 'DELETE',
                        success: function(response) {
                            console.log(response.data)
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
                            force: (syncType == 'force')
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
            if (provider.id === 'mock') return; // Skip 'mock' provider
            $dropdown.append(`<a class="dropdown-item" href="#" onclick="window.open('/providers/${provider.id}/connect?key=${$('#veridaKey').val()}', '_blank');">
                <img src="${provider.icon}" alt="${provider.label}" style="width: 20px; height: 20px; margin-right: 5px;">
                ${provider.label}
            </a>`);
        });
    }

    function getProviderDetails(providerId) {
        return window.providersData[providerId] || { icon: 'default-icon.png', label: 'Unknown' };
    }
});
