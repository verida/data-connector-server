$(document).ready(function() {
    let offset = 0;
    const apiUrl = '/api/v1/data';
    let currentSortField = '';
    let currentSortDirection = 'asc';

    // Load Verida Key and Schema from local storage
    $('#veridaKey').val(localStorage.getItem('veridaKey') || '');
    $('#schema').val(localStorage.getItem('schema') || '');

    function fetchData() {
        const veridaKey = $('#veridaKey').val();
        const schema = $('#schema').val();
        const limit = $('#limit').val();
        const sortField = currentSortField;
        const sortDirection = currentSortDirection;

        // Show loading message
        $('#tableBody').html('<tr><td colspan="100%" class="text-center">Loading...</td></tr>');
        $('.alert').hide(); // Hide previous error messages

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
                    const sortIcon = (header === currentSortField) ? (currentSortDirection === 'asc' ? '▲' : '▼') : '';
                    $('#tableHeaders').append(`<th class="sortable" data-field="${header}">${header} ${sortIcon}</th>`);
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
                $('#sortField').empty();
                headers.forEach(header => {
                    $('#sortField').append(`<option value="${header}">${header}</option>`);
                });
                $('#sortField').val(currentSortField);

                // Handle pagination
                $('#prevButton').toggleClass('disabled', options.skip === 0);
                $('#nextButton').toggleClass('disabled', results.length < limit);
            },
            error: function(jqXHR) {
                const error = jqXHR.responseJSON ? jqXHR.responseJSON.error : 'An error occurred';
                $('.alert').text(error).show();
            }
        });
    }

    // Save Verida Key and Schema to local storage
    $('#veridaKey').on('input', function() {
        localStorage.setItem('veridaKey', $(this).val());
    });

    $('#schema').on('input', function() {
        localStorage.setItem('schema', $(this).val());
    });

    // Handle column header click for sorting
    $('#tableHeaders').on('click', '.sortable', function() {
        const field = $(this).data('field');
        if (field === currentSortField) {
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortField = field;
            currentSortDirection = 'asc';
        }
        $('#sortField').val(currentSortField);
        $('#sortDirection').val(currentSortDirection);
        fetchData();
    });

    // Update sort field and direction on dropdown change
    $('#sortField').change(function() {
        const field = $(this).val();
        if (field === currentSortField) {
            currentSortDirection = $('#sortDirection').val();
        } else {
            currentSortField = field;
            currentSortDirection = 'asc';
        }
        $('#sortDirection').val(currentSortDirection);
        fetchData();
    });

    $('#sortDirection').change(function() {
        currentSortDirection = $(this).val();
        fetchData();
    });

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
