$(document).ready(function() {
    // Fetch data from the endpoint
    $.getJSON('/api/v1/providers', function(data) {
        // Loop through the data and create table rows
        $.each(data, function(key, provider) {
            const row = `
                <tr>
                    <td><img src="${provider.icon}" alt="${provider.label}" style="width: 40px; height: 40px;"></td>
                    <td>${provider.label}</td>
                    <td>
                        <button class="btn btn-primary connect-btn" data-provider="${provider.name}">Connect</button>
                        <button class="btn btn-success sync-btn" data-provider="${provider.name}">Sync</button>
                    </td>
                </tr>
            `;
            $('#providerTable').append(row);
        });

        // Add event listeners for the buttons
        $('.connect-btn').click(function() {
            const provider = $(this).data('provider');
            alert(`Connecting to ${provider}...`);
            // Add your connect logic here
        });

        $('.sync-btn').click(function() {
            const provider = $(this).data('provider');
            alert(`Syncing with ${provider}...`);
            // Add your sync logic here
        });
    }).fail(function() {
        alert('Failed to fetch provider data.');
    });
});