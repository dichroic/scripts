// ==UserScript==
// @name         Home Depot eReceipts
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Download a csv of your Home Depot eReceipts
// @author       You
// @match        https://www.homedepot.com/order/view/ereceipt/summary
// @icon         https://www.google.com/s2/favicons?sz=64&domain=homedepot.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const authorization = document.cookie
    .split("; ")
    .find((row) => row.startsWith("THD_USER_SESSION="))
    ?.split("=")[1]

    fetch('https://www.homedepot.com/customer/order/v1/ereceipts/summary', {
        headers: {
            accept: 'application/json',
            'cache-control': 'no-cache',
            authorization,
        }
    })
        .then(response => {
        if (response.ok) {
            return response;
        } else {
            let errorMessage = `${response.status} (${response.statusText})`,
                error = new Error(errorMessage);
            throw(error);
        }
    })
        .then(response => {
        return response.json();
    })
        .then(body => {
        const items = body.ereceipts
        const keys = Object.keys(items[0])

        let csv = keys.join(',') + '\r\n'

        items.forEach(row => {
            const entries = keys.map(key => row[key])
            csv += entries.join(',') + '\r\n'
        })

        let link = document.createElement('a')
        link.id = 'download-csv'
        link.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(csv));
        link.setAttribute('download', 'homedepot-ereceipts.csv');
        link.setAttribute('class', 'u--padding u__vertical-align-flex u__inline-block');
        link.innerText = "Download CSV";

        const dropdown = document.querySelectorAll('[data-automation-id="dropdown-sort"]')[0].parentElement
        dropdown.parentElement.appendChild(link)
    })
        .catch(error => console.error(`Error in fetch: ${error.message}`))
})();