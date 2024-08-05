$(document).ready(function() {
    let offset = 0;
    const apiUrl = '/api/v1/data';

    function fetchData() {
        const veridaKey = $('#veridaKey').val();
        const schema = $('#schema').val();
        const limit = $('#limit').val();
        const sortField = $('#sortField').val();
        const sortDirection = $('#sortDirection').val();

        $.ajax({
            url: apiUrl,
            data: {
                key: veridaKey,
                schema: schema,
                limit: limit,
                offset: offset,
                sort: sortField ? `${sortField}:${sortDirection}` : ''
            },
            success: function(response) {
                const results = response.results;
                const options = response.options;
                const headers = Object.keys(results[0] || {});

                // Populate table headers
                $('#tableHeaders').empty();
                headers.forEach(header => {
                    $('#tableHeaders').append(`<th>${header}</th>`);
                });

                // Populate table rows
                $('#tableBody').empty();
                results.forEach(row => {
                    let rowHtml = '<tr>';
                    headers.forEach(header => {
                        rowHtml += `<td>${row[header] || ''}</td>`;
                    });
                    rowHtml += '</tr>';
                    $('#tableBody').append(rowHtml);
                });

                // Populate sort field dropdown
                if (sortField === null) {
                    $('#sortField').empty();
                    headers.forEach(header => {
                        $('#sortField').append(`<option value="${header}">${header}</option>`);
                    });
                }

                // Handle pagination
                $('#prevButton').toggleClass('disabled', options.skip === 0);
                $('#nextButton').toggleClass('disabled', results.length < limit);
            }
        });
    }

    $('#searchButton').click(fetchData);

    $('#prevButton').click(function(e) {
        e.preventDefault();
        if (offset > 0) {
            offset -= parseInt($('#limit').val());
            fetchData();
        }
    });

    $('#nextButton').click(function(e) {
        e.preventDefault();
        offset += parseInt($('#limit').val());
        fetchData();
    });

    // Example of listing schemas
    $('#schemaModal').on('show.bs.modal', function() {
        $('#schemaList').html('<li>schema1</li><li>schema2</li><li>schema3</li>');
    });
});
