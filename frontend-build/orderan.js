document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.getElementById('orderTableBody');
    const emptyState = document.getElementById('empty-state');
    const loadingRow = document.getElementById('loading-row');
    const grandTotalSection = document.getElementById('grand-total-section');
    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
    
    const API_BASE_URL = ''; // Tambahkan URL API Anda jika ada
    const token = localStorage.getItem('authToken');

    let sparepartData = {}; 
    let currentAggregatedItems = {}; 

    function formatRupiah(number) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(number);
    }

    async function fetchSparepartData() {
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/spareparts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Gagal mengambil data master sparepart.');
            const data = await response.json();
            sparepartData = {};
            data.forEach(part => {
                const cleanPartNumber = part.part_number;
                if (cleanPartNumber) {
                    sparepartData[cleanPartNumber] = {
                        name: part.part_name || 'Nama tidak tersedia',
                        price: Number(part.price) || 0
                    };
                }
            });
        } catch (error) {
            console.error("Error fetching sparepart data:", error);
            throw error;
        }
    }

    async function fetchAndProcessOrders() {
        if (!token) {
            loadingRow.innerHTML = `<td colspan="7" class="text-center py-8">Login diperlukan.</td>`;
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/orders/list`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Gagal mengambil daftar orderan.');
            const orders = await response.json();
            processAndRenderTable(orders);
        } catch (error) {
            console.error("Error fetching orders:", error);
            loadingRow.innerHTML = `<td colspan="7" class="text-center py-8 text-red-600">${error.message}</td>`;
        }
    }

    function processAndRenderTable(orders) {
        if (orders.length === 0) {
            loadingRow.classList.add('hidden');
            emptyState.classList.remove('hidden');
            grandTotalSection.classList.add('hidden');
            return;
        }

        const aggregatedItems = {};
        orders.forEach(order => {
            const partNumberMatch = order.items.match(/^([^\s(]+)/);
            if (!partNumberMatch) return;
            const partNumber = partNumberMatch[1].trim(); 
            const qtyMatch = order.items.match(/Qty: (\d+)/);
            const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
            const foundPart = sparepartData[partNumber];

            if (aggregatedItems[partNumber]) {
                aggregatedItems[partNumber].qty += qty;
                aggregatedItems[partNumber].orderIds.add(order.id);
            } else {
                aggregatedItems[partNumber] = {
                    partNumber: partNumber,
                    qty: qty,
                    orderIds: new Set([order.id]),
                    name: foundPart?.name || 'Nama tidak ditemukan',
                    price: foundPart?.price ?? 0,
                    priceFound: !!foundPart
                };
            }
        });

        currentAggregatedItems = aggregatedItems;
        renderTable();
    }

    function renderTable() {
        tableBody.innerHTML = ''; 
        const items = Object.values(currentAggregatedItems);

        if (items.length === 0) {
            loadingRow.classList.add('hidden');
            emptyState.classList.remove('hidden');
            grandTotalSection.classList.add('hidden');
            return;
        }

        let rowNum = 1;
        items.forEach(item => {
            const totalPerRow = item.qty * item.price;
            const row = document.createElement('tr');
            if (!item.priceFound) row.className = 'bg-red-500/10';

            row.innerHTML = `
                <td>${rowNum++}</td>
                <td>
                    <div class="font-medium">${item.partNumber}</div>
                    <div style="font-size:11px;color:#6b7280">IDs: ${Array.from(item.orderIds).join(', ')}</div>
                </td>
                <td>${item.name}</td>
                <td style="text-align:center">
                    <input type="number" min="0" value="${item.qty}" class="qty-input">
                </td>
                <td style="text-align:right; font-family:monospace">${item.priceFound ? formatRupiah(item.price) : 'N/A'}</td>
                <td style="text-align:right; font-family:monospace; font-weight:bold" class="row-total">
                    ${item.priceFound ? formatRupiah(totalPerRow) : 'N/A'}
                </td>
                <td style="text-align:center">
                    <button class="delete-btn" title="Hapus Item">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;

            // EVENT: Input Qty (Konfirmasi jika 0)
            const input = row.querySelector('.qty-input');
            input.addEventListener('change', function() {
                const newQty = parseInt(this.value);
                if (newQty === 0) {
                    handleDeleteItem(item.partNumber);
                } else if (!isNaN(newQty) && newQty > 0) {
                    currentAggregatedItems[item.partNumber].qty = newQty;
                    recalculateGlobals();
                } else {
                    this.value = currentAggregatedItems[item.partNumber].qty;
                }
            });

            // EVENT: Tombol Sampah
            row.querySelector('.delete-btn').addEventListener('click', () => {
                handleDeleteItem(item.partNumber);
            });

            tableBody.appendChild(row);
        });

        recalculateGlobals();
        loadingRow.classList.add('hidden');
        emptyState.classList.add('hidden');
        grandTotalSection.classList.remove('hidden');
    }

    function handleDeleteItem(partNumber) {
        const confirmMsg = `Hapus "${partNumber}" dari daftar orderan?`;
        if (confirm(confirmMsg)) {
            delete currentAggregatedItems[partNumber];
            renderTable();
        } else {
            // Kembalikan qty ke 1 jika user cancel hapus dari input 0
            if(currentAggregatedItems[partNumber].qty === 0 || isNaN(currentAggregatedItems[partNumber].qty)) {
                currentAggregatedItems[partNumber].qty = 1;
            }
            renderTable();
        }
    }

    function recalculateGlobals() {
        let subtotal = 0;
        Object.values(currentAggregatedItems).forEach(item => {
            if (item.priceFound) subtotal += (item.qty * item.price);
        });

        const ppn = subtotal * 0.11;
        const total = subtotal + ppn;

        document.getElementById('grand-subtotal').textContent = formatRupiah(subtotal);
        document.getElementById('grand-ppn').textContent = formatRupiah(ppn);
        document.getElementById('grand-total').textContent = formatRupiah(total);
    }

    async function initialize() {
        try {
            await fetchSparepartData();
            await fetchAndProcessOrders();
        } catch (e) {
            loadingRow.innerHTML = `<td colspan="7" class="text-center py-8 text-red-600">Gagal inisialisasi data.</td>`;
        }
    }

    initialize();

    // Event Konfirmasi Pembayaran
    confirmPaymentBtn.addEventListener('click', function() {
        const totalText = document.getElementById('grand-total').textContent;
        const totalAmount = parseFloat(totalText.replace(/[^0-9]/g, ''));

        if (totalAmount <= 0) {
            alert("Tidak ada item valid untuk dibayar.");
            return;
        }

        const itemsForStorage = {};
        for (const key in currentAggregatedItems) {
            itemsForStorage[key] = {
                ...currentAggregatedItems[key],
                orderIds: Array.from(currentAggregatedItems[key].orderIds)
            };
        }

        const paymentDetails = { total: totalAmount, items: itemsForStorage };
        localStorage.setItem('paymentDetails', JSON.stringify(paymentDetails));
        window.location.href = 'payment.html';
    });
});