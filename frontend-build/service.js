/* services.js - FINAL FIXED VERSION 2.0 */

// --- KONFIGURASI ---
const API_BASE_URL = 'https://endlessproject.my.id'; 
let token = localStorage.getItem('authToken');

// Variabel Data Global
let allItemsData = [];
let cart = [];
let currentCar = JSON.parse(localStorage.getItem('currentCar')) || null;

// Data Mobil (UI)
const carData = [
    { model: "TIGGO CROSS", icon: "🚗" },
    { model: "Chery Tiggo 7 Pro", icon: "🚙" },
    { model: "Chery Tiggo 8 Pro", icon: "🚐" },
    { model: "Omoda 5 Z", icon: "🚕" },
    { model: "OMODA 5 GT", icon: "🚙" }
];

// --- FUNGSI UTILITY ---
function saveData() {
    localStorage.setItem('currentServiceInvoice', JSON.stringify(cart));
    localStorage.setItem('currentCar', JSON.stringify(currentCar));
}

function showMessage(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.className = 'fixed top-5 right-5 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-[100] text-sm animate-fade-in-down';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// --- API FETCH DATA ---
async function fetchAllData(carModel = null) {
    const tokenLocal = localStorage.getItem('authToken');
    if (!tokenLocal) {
        alert("Sesi habis, silakan login ulang.");
        window.location.href = 'index.html';
        return [];
    }

    try {
        let sparepartUrl = carModel 
            ? `${API_BASE_URL}/api/spareparts/by-type?type=${encodeURIComponent(carModel)}`
            : `${API_BASE_URL}/api/spareparts`;

        const [sparepartRes, serviceRes] = await Promise.all([
            fetch(sparepartUrl, { headers: { 'Authorization': `Bearer ${tokenLocal}` } }),
            fetch(`${API_BASE_URL}/api/services`, { headers: { 'Authorization': `Bearer ${tokenLocal}` } })
        ]);

        const spareparts = sparepartRes.ok ? await sparepartRes.json() : [];
        const services = serviceRes.ok ? await serviceRes.json() : [];

        // Format Data
        const formattedSpareparts = (Array.isArray(spareparts) ? spareparts : []).map(item => ({
            code: item.part_number || '',
            name: item.part_name || '',
            price: typeof item.price === 'number' ? item.price : Number(item.price) || 0,
            type: 'sparepart',
            label: 'Pcs',
            quantity: 1 
        }));

        const formattedServices = (Array.isArray(services) ? services : []).map(item => ({
            code: item.code || '',
            name: item.name || '',
            price: typeof item.price === 'number' ? item.price : Number(item.price) || 0,
            type: 'service',
            label: 'Jam',
            duration: 60 
        }));

        allItemsData = [...formattedServices, ...formattedSpareparts];
        return allItemsData;
        
    } catch (error) {
        console.error("Error fetching data:", error);
        return [];
    }
}

// --- CORE: CART LOGIC ---
function addToCart(code) {
    const item = allItemsData.find(i => i.code === code);
    if (!item) {
        showMessage('Item tidak ditemukan di sistem lokal');
        return;
    }
    const existing = cart.find(c => c.code === code);
    
    if (existing) {
        // Jika Jasa +1 menit, Sparepart +1 pcs
        const increment = item.type === 'service' ? 1 : 1; 
        existing.quantity = (existing.quantity || 0) + increment;
    } else {
        // Default Jasa = 60 menit, Sparepart = 1 pcs
        const defaultQty = item.type === 'service' ? 60 : 1;
        cart.push({ ...item, quantity: defaultQty });
    }
    
    saveData();
    showMessage(`${item.name} ditambahkan`);
    
    // Refresh UI
    if (window.location.pathname.includes('detail.html')) {
        renderSelectedItems();
        updateConfirmButton();
    }
}

window.updateCartQuantity = function(code, delta) {
    const item = cart.find(c => c.code === code);
    if (item) {
        const newQty = (item.quantity || 1) + delta;
        if (newQty <= 0) {
            removeFromCart(code);
        } else {
            item.quantity = newQty;
            saveData();
            renderSelectedItems();
            updateConfirmButton();
        }
    }
}

window.updateCartQuantityInput = function(code, value) {
    const item = cart.find(c => c.code === code);
    const newQty = parseInt(value);
    if (item && !isNaN(newQty) && newQty > 0) {
        item.quantity = newQty;
        saveData();
        renderSelectedItems();
        updateConfirmButton();
    } else if (item && newQty <= 0) {
        removeFromCart(code);
    }
}

window.removeFromCart = function(code) {
    cart = cart.filter(i => i.code !== code);
    saveData();
    renderSelectedItems();
    updateConfirmButton();
}

// --- SEARCH BAR LOGIC ---
function setupItemSearch(inputId, dropdownId, sourceData, itemType) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if(!input || !dropdown) return;

    const renderDropdown = (items) => {
        dropdown.innerHTML = '';
        
        // --- LOGIKA TOMBOL TAMBAH JASA (JIKA KOSONG) ---
        if (items.length === 0) {
            if (itemType === 'service') {
                dropdown.innerHTML = `
                    <div class="p-4 text-center bg-white">
                        <p class="text-gray-500 text-sm mb-3">"${input.value}" tidak ditemukan.</p>
                        <button onclick="openJasaModal('${input.value}')" class="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-full font-semibold hover:bg-red-100 transition w-full border border-red-200">
                            + Tambah Jasa Baru
                        </button>
                    </div>
                `;
            } else {
                dropdown.innerHTML = `<div class="p-3 text-gray-500 bg-white">Tidak ada hasil.</div>`;
            }
            dropdown.classList.remove('hidden'); 
            return;
        }

        // Tampilkan maks 10 item (CSS membatasi tinggi visual)
        items.slice(0, 10).forEach(item => { 
            const el = document.createElement('div');
            el.className = 'p-3 hover:bg-gray-100 bg-white cursor-pointer flex justify-between items-center border-b border-gray-100 last:border-0';
            
            el.innerHTML = `
                <div>
                    <div class="font-medium text-gray-800">${item.name}</div>
                    <div class="text-sm text-gray-500">
                        <span class="bg-gray-100 text-gray-600 px-1 rounded border text-xs mr-1">${item.code}</span> 
                        | Rp ${item.price.toLocaleString('id-ID')} ${itemType === 'service' ? '/jam' : ''}
                    </div>
                </div>
            `;
            
            // KLIK ITEM: Masukkan ke cart & Bersihkan Search Bar
            el.addEventListener('click', () => {
                addToCart(item.code);
                input.value = ''; 
                dropdown.classList.add('hidden'); 
            });
            dropdown.appendChild(el);
        });
        dropdown.classList.remove('hidden');
    };

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length < 1) { 
            dropdown.classList.add('hidden');
            return;
        }
        const results = sourceData.filter(item => {
            const nameMatch = item.name && item.name.toLowerCase().includes(query);
            const codeMatch = item.code && String(item.code).toLowerCase().includes(query);
            return nameMatch || codeMatch;
        });
        renderDropdown(results);
    });

    // Tutup jika klik di luar
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== input) {
            dropdown.classList.add('hidden');
        }
    });
}

// --- RENDER CART UI (SUDAH DIPERBAIKI) ---
function renderSelectedItems() {
    const sparepartContainer = document.getElementById('selectedSpareparts');
    const jasaContainer = document.getElementById('selectedJasa');
    if (!sparepartContainer || !jasaContainer) return;
    
    sparepartContainer.innerHTML = '';
    jasaContainer.innerHTML = '';

    const sparepartsInCart = cart.filter(i => i.type === 'sparepart');
    const servicesInCart = cart.filter(i => i.type === 'service');
    
    if (sparepartsInCart.length > 0) {
        sparepartsInCart.forEach(item => sparepartContainer.appendChild(createCartItemElement(item)));
    }
    if (servicesInCart.length > 0) {
        servicesInCart.forEach(item => jasaContainer.appendChild(createCartItemElement(item)));
    }
}

function createCartItemElement(item) {
    const el = document.createElement('div');
    el.className = 'flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200';
    
    const unitPrice = item.price || 0;
    let totalItemPrice = 0;
    let unitLabel = '';
    let step = 1;

    if (item.type === 'service') {
        // Jasa: (Harga/60) * Menit
        totalItemPrice = (unitPrice / 60) * (item.quantity || 60);
        unitLabel = 'mnt';
        step = 1; // Step 1 menit
    } else {
        // Sparepart: Harga * Pcs
        totalItemPrice = unitPrice * (item.quantity || 1);
        unitLabel = 'pcs';
        step = 1;
    }

    const priceDisplay = Math.round(totalItemPrice).toLocaleString('id-ID');

    el.innerHTML = `
        <div class="flex-1 min-w-0 pr-2">
            <div class="font-semibold text-gray-800 truncate">${item.name}</div>
            <div class="text-xs text-gray-500">
                ${item.type === 'service' ? `Rate: Rp ${unitPrice.toLocaleString('id-ID')}/jam` : `@ Rp ${unitPrice.toLocaleString('id-ID')}/pcs`}
            </div>
            <div class="text-sm text-red-600 font-bold">Total: Rp ${priceDisplay}</div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
            <button onclick="updateCartQuantity('${item.code}', -${step})" class="text-red-500 font-bold p-1 border rounded w-8 bg-white">-</button>
            <input type="number" value="${item.quantity}" min="1" onchange="updateCartQuantityInput('${item.code}', this.value)" class="w-14 text-center border rounded text-sm py-1">
            <span class="text-xs text-gray-500 w-6">${unitLabel}</span>
            <button onclick="updateCartQuantity('${item.code}', ${step})" class="text-green-600 font-bold p-1 border rounded w-8 bg-white">+</button>
            <button onclick="removeFromCart('${item.code}')" class="ml-2 text-gray-400 hover:text-red-500"><i class="fas fa-trash"></i></button>
        </div>
    `;
    return el;
}

// --- TOMBOL KONFIRMASI ---
function updateConfirmButton() {
    const confirmBtn = document.getElementById('confirmBtn');
    if (!confirmBtn) return;
    
    // Hitung Total Uang
    const totalHarga = cart.reduce((total, item) => {
        if (item.type === 'service') {
            return total + ((item.price / 60) * (item.quantity || 0));
        } else {
            return total + ((item.price || 0) * (item.quantity || 0));
        }
    }, 0);

    const totalQty = cart.length;

    if (totalQty > 0) {
        confirmBtn.classList.remove('hidden');
        confirmBtn.innerHTML = `✓ Konfirmasi Invoice Rp ${Math.round(totalHarga).toLocaleString('id-ID')}`;
        
        confirmBtn.onclick = () => {
             saveData();
             window.location.href = 'invoice.html';
        };
    } else {
        confirmBtn.classList.add('hidden');
    }
}

// --- PAGE INITIALIZATION ---
async function initDetailPageUI() {
    const title = document.getElementById('detailTitle');
    const backBtn = document.getElementById('backBtn');
    
    if (!currentCar) {
         window.location.href = 'services.html';
         return; 
    }
    
    title.innerHTML = `Invoice Estimasi: ${currentCar.model}`;
    backBtn.onclick = () => window.location.href = 'services.html'; 

    const sparepartContainer = document.getElementById('selectedSpareparts');
    const jasaContainer = document.getElementById('selectedJasa');
    if (sparepartContainer) sparepartContainer.innerHTML = '<div class="text-center py-4 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Memuat data...</div>';
    
    const data = await fetchAllData(currentCar.model);
    
    let filteredSpareparts = data.filter(item => item.type === 'sparepart');
    let filteredServices = data.filter(item => item.type === 'service');

    setupItemSearch('sparepartSearch', 'sparepartDropdown', filteredSpareparts, 'sparepart');
    setupItemSearch('jasaSearch', 'jasaDropdown', filteredServices, 'service');

    renderSelectedItems();
    updateConfirmButton(); // Cek tombol saat load
}

function renderCarCards() {
    const container = document.getElementById('listContainer');
    if(!container) return; 
    
    container.innerHTML = carData.map(car => `
        <div class="service-card bg-white p-6 rounded-xl shadow hover:shadow-lg transition cursor-pointer text-center" onclick="selectCar('${car.model.replace(/'/g, "\\'")}')">
            <div class="text-6xl mb-4">${car.icon}</div>
            <h3 class="text-xl font-bold text-gray-800">${car.model}</h3>
            <p class="text-gray-500 text-sm mt-2">Klik untuk estimasi</p>
        </div>
    `).join('');
}

window.selectCar = async function(model) {
    const prevCar = JSON.parse(localStorage.getItem('currentCar'));
    if (prevCar && prevCar.model !== model) {
        cart = [];
        localStorage.setItem('currentServiceInvoice', JSON.stringify([]));
    }
    const car = carData.find(c => c.model === model);
    currentCar = car;
    localStorage.setItem('currentCar', JSON.stringify(currentCar));
    window.location.href = 'detail.html';
};

// --- LOGIKA MODAL TAMBAH JASA ---
window.openJasaModal = function(prefillName = '') {
    const modal = document.getElementById('addJasaModal');
    const nameInput = document.getElementById('newJasaName');
    if(nameInput) nameInput.value = prefillName; 
    if(modal) modal.classList.remove('hidden');
}

window.closeJasaModal = function() {
    const modal = document.getElementById('addJasaModal');
    if(modal) modal.classList.add('hidden');
    document.getElementById('addJasaForm').reset();
}

document.getElementById('addJasaForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newJasaName').value;
    const price = document.getElementById('newJasaPrice').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Menyimpan...';
    submitBtn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/api/services/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ name: name, price: parseFloat(price) })
        });

        if (!res.ok) throw new Error('Gagal');
        const newItem = await res.json();

        const formattedItem = {
            code: newItem.code,
            name: newItem.name,
            price: newItem.price,
            type: 'service', 
            label: 'Jam',
            quantity: 60 // Default 60 menit
        };

        // Tambah ke data lokal & Cart
        allItemsData.push(formattedItem); 
        addToCart(formattedItem.code);    

        closeJasaModal();
        
        // Clear search UI
        const searchInput = document.getElementById('jasaSearch');
        const dropdown = document.getElementById('jasaDropdown');
        if(searchInput) searchInput.value = '';
        if(dropdown) dropdown.classList.add('hidden');

    } catch (error) {
        console.error(error);
        alert('Gagal menyimpan jasa.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

// --- INVOICE PAGE ---
function initInvoicePage() {
    const invoiceItems = document.getElementById('invoiceItems');
    if (!invoiceItems) return;

    const cartData = JSON.parse(localStorage.getItem('currentServiceInvoice') || '[]');
    const carData = JSON.parse(localStorage.getItem('currentCar') || '{}');

    document.getElementById('invoiceNumber').innerText = `INV-${Date.now().toString().slice(-6)}`;
    document.getElementById('invoiceDate').innerText = new Date().toLocaleDateString('id-ID');

    let subtotal = 0;
    invoiceItems.innerHTML = '';

    if (cartData.length === 0) {
        invoiceItems.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500">Tidak ada item.</td></tr>`;
    }

    cartData.forEach(item => {
        let itemTotal = 0;
        let qtyDisplay = '';
        let priceUnitDisplay = '';

        if (item.type === 'service') {
            const qty = item.quantity || 60; 
            itemTotal = (item.price / 60) * qty;
            priceUnitDisplay = `Rp ${item.price.toLocaleString('id-ID')}/jam`;
            qtyDisplay = `${qty} Menit`;
        } else {
            const qty = item.quantity || 1;
            itemTotal = item.price * qty;
            priceUnitDisplay = `Rp ${item.price.toLocaleString('id-ID')}`;
            qtyDisplay = `${qty} Pcs`;
        }

        subtotal += itemTotal;

        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-gray-50";
        tr.innerHTML = `
            <td class="p-3">
                <div class="font-medium text-gray-800">${item.name}</div>
                <div class="text-xs text-gray-500">${item.code}</div>
            </td>
            <td class="p-3 text-gray-600">${carData.model || '-'}</td>
            <td class="p-3 text-right text-sm">${priceUnitDisplay}</td>
            <td class="p-3 text-center">${qtyDisplay}</td>
            <td class="p-3 text-right font-bold">Rp ${Math.round(itemTotal).toLocaleString('id-ID')}</td>
        `;
        invoiceItems.appendChild(tr);
    });

    const ppn = subtotal * 0.11;
    const grandTotal = subtotal + ppn;

    document.getElementById('invoiceSubtotal').innerText = `Rp ${Math.round(subtotal).toLocaleString('id-ID')}`;
    document.getElementById('invoicePPN').innerText = `Rp ${Math.round(ppn).toLocaleString('id-ID')}`;
    document.getElementById('invoiceTotal').innerText = `Rp ${Math.round(grandTotal).toLocaleString('id-ID')}`;

    const printBtn = document.getElementById('printBtn');
    if(printBtn) printBtn.onclick = () => window.print();
}

// --- APP INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        cart = JSON.parse(localStorage.getItem('currentServiceInvoice') || '[]');
    } catch (e) { cart = []; }
    
    const path = window.location.pathname;
    if (path.includes('services.html')) {
        renderCarCards();
    } else if (path.includes('detail.html')) {
        await initDetailPageUI();
    } else if (path.includes('invoice.html')) {
        initInvoicePage();
    } else {
        renderCarCards();
    }
});