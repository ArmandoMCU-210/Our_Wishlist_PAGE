(() => {
    'use strict';

    const IMPORTANCE_LEVELS = window.IMPORTANCE_LEVELS || ['Me gustaría', 'Lo quiero', 'Muchísimo'];
    const IMPORTANCE_ICONS = ['🤍', '💗💗', '💖💖💖'];

    const state = {
        gifts: [],
        tab: 'pending',
        search: '',
        importance: '',
        sort: 'created_desc',
        selectedImportance: '',
        editingId: null,
        pendingDeleteId: null,
        pendingPasswordAction: null, // { giftId, delivered }
    };

    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

    const grid = $('#gifts-grid');
    const emptyState = $('#empty-state');
    const emptyStateText = $('#empty-state-text');
    const loadingState = $('#loading-state');
    const counterEl = $('#gift-counter');

    // ---------- Utilidades ----------

    function debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function showToast(message, type = 'success') {
        const container = $('#toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'fa-heart' : 'fa-circle-exclamation';
        toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function openModal(id) {
        $(`#${id}`).classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(id) {
        $(`#${id}`).classList.add('hidden');
        document.body.style.overflow = '';
    }

    $$('[data-close]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    $$('.modal').forEach((modal) => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            $$('.modal:not(.hidden)').forEach((m) => closeModal(m.id));
        }
    });

    // ---------- Carga de datos ----------

    async function fetchGifts() {
        loadingState.classList.remove('hidden');
        grid.innerHTML = '';
        emptyState.classList.add('hidden');

        const params = new URLSearchParams();
        params.set('delivered', state.tab === 'delivered' ? 'true' : 'false');
        if (state.search) params.set('search', state.search);
        if (state.importance) params.set('importance', state.importance);
        params.set('sort', state.sort);

        try {
            const res = await fetch(`/api/gifts?${params.toString()}`);
            if (!res.ok) throw new Error('No pude cargar tu lista de deseos, inténtalo de nuevo.');
            state.gifts = await res.json();
            renderGifts();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            loadingState.classList.add('hidden');
        }
        updateCounter();
    }

    async function updateCounter() {
        try {
            const res = await fetch('/api/gifts');
            const all = await res.json();
            const total = all.length;
            const delivered = all.filter((g) => g.delivered).length;
            counterEl.textContent = `${total} deseo${total === 1 ? '' : 's'} guardado${total === 1 ? '' : 's'} con amor · ${delivered} ya ${delivered === 1 ? 'es tuyo' : 'son tuyos'}`;
        } catch { /* silencioso: el contador no es crítico */ }
    }

    // ---------- Render ----------

    function renderGifts() {
        grid.innerHTML = '';
        if (state.gifts.length === 0) {
            emptyStateText.textContent = state.tab === 'pending'
                ? 'Aún no hay ninguna cosita guardada, mi amor. Toca el botón + para agregar tu primer deseo.'
                : 'Todavía no tienes ningún tesoro aquí, mi amor, pero ya casi es momento 💗';
            emptyState.classList.remove('hidden');
            return;
        }
        emptyState.classList.add('hidden');

        state.gifts.forEach((gift, index) => {
            grid.appendChild(buildCard(gift, index));
        });
    }

    function buildCard(gift, index) {
        const levelIndex = IMPORTANCE_LEVELS.indexOf(gift.importance);
        const icon = IMPORTANCE_ICONS[levelIndex] || '';
        const card = document.createElement('div');
        card.className = `gift-card${gift.delivered ? ' is-delivered' : ''}`;
        card.style.animationDelay = `${Math.min(index * 0.05, 0.6)}s`;

        card.innerHTML = `
            <div class="gift-card-image-wrap" data-action="preview">
                <img src="${escapeHtml(gift.image_url)}" alt="${escapeHtml(gift.name)}" loading="lazy">
                <div class="importance-badge level-${levelIndex}">${icon} ${escapeHtml(gift.importance)}</div>
                ${gift.delivered ? '<div class="delivered-ribbon">Tuyo</div>' : ''}
            </div>
            <div class="gift-card-body">
                <h3>${escapeHtml(gift.name)}</h3>
                ${gift.description ? `<p class="gift-card-desc">${escapeHtml(gift.description)}</p>` : ''}
                <div class="gift-card-meta">
                    ${gift.store ? `<span><i class="fa-solid fa-shop"></i> ${escapeHtml(gift.store)}</span>` : ''}
                    ${gift.purchase_link ? `<span><i class="fa-solid fa-link"></i> <a href="${escapeHtml(gift.purchase_link)}" target="_blank" rel="noopener noreferrer">Ver dónde comprarlo</a></span>` : ''}
                    ${gift.delivered ? `<span class="delivered-note"><i class="fa-solid fa-heart"></i> Entregado el ${formatDate(gift.delivered_at)}</span>` : ''}
                </div>
                <div class="gift-card-actions">
                    <button class="icon-btn" data-action="edit" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn danger" data-action="delete" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    ${gift.delivered
                        ? '<button class="icon-btn deliver" data-action="undeliver" title="Marcar como pendiente"><i class="fa-solid fa-rotate-left"></i></button>'
                        : '<button class="icon-btn deliver" data-action="deliver" title="Marcar como entregado"><i class="fa-solid fa-gift"></i></button>'}
                </div>
            </div>
        `;

        card.querySelector('[data-action="preview"]').addEventListener('click', () => openLightbox(gift));
        card.querySelector('[data-action="edit"]').addEventListener('click', () => openGiftModal('edit', gift));
        card.querySelector('[data-action="delete"]').addEventListener('click', () => openDeleteModal(gift));
        const deliverBtn = card.querySelector('[data-action="deliver"], [data-action="undeliver"]');
        deliverBtn.addEventListener('click', () => openPasswordModal(gift, !gift.delivered));

        return card;
    }

    function openLightbox(gift) {
        $('#lightbox-img').src = gift.image_url;
        $('#lightbox-img').alt = gift.name;
        openModal('lightbox-modal');
    }

    // ---------- Tabs / filtros ----------

    $$('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            $$('.tab-btn').forEach((b) => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            state.tab = btn.dataset.tab;
            fetchGifts();
        });
    });

    $('#search-input').addEventListener('input', debounce((e) => {
        state.search = e.target.value.trim();
        fetchGifts();
    }, 350));

    $('#importance-filter').addEventListener('change', (e) => {
        state.importance = e.target.value;
        fetchGifts();
    });

    $('#sort-select').addEventListener('change', (e) => {
        state.sort = e.target.value;
        fetchGifts();
    });

    // ---------- Modal: agregar / editar regalo ----------

    const giftForm = $('#gift-form');
    const imageInput = $('#gift-image');
    const imagePreview = $('#image-preview');
    const uploadPlaceholder = $('#upload-placeholder');
    const uploadLabel = $('#image-upload-label');
    const importancePicker = $('#importance-picker');

    $('#add-gift-btn').addEventListener('click', () => openGiftModal('create'));

    function openGiftModal(mode, gift = null) {
        state.editingId = mode === 'edit' ? gift.id : null;
        giftForm.reset();
        $('#image-error').textContent = '';
        imagePreview.classList.add('hidden');
        imagePreview.src = '';
        uploadPlaceholder.classList.remove('hidden');
        state.selectedImportance = '';
        $$('.importance-option', importancePicker).forEach((b) => b.classList.remove('selected'));

        if (mode === 'edit') {
            $('#gift-modal-title').textContent = 'Editar deseo';
            $('#gift-submit-btn').textContent = 'Guardar cambios 💕';
            $('#gift-name').value = gift.name;
            $('#gift-description').value = gift.description || '';
            $('#gift-link').value = gift.purchase_link || '';
            $('#gift-store').value = gift.store || '';
            state.selectedImportance = gift.importance;
            selectImportanceButton(gift.importance);
            imagePreview.src = gift.image_url;
            imagePreview.classList.remove('hidden');
            uploadPlaceholder.classList.add('hidden');
        } else {
            $('#gift-modal-title').textContent = 'Un nuevo deseo';
            $('#gift-submit-btn').textContent = 'Guardar deseo 💕';
        }

        openModal('gift-modal');
    }

    function selectImportanceButton(value) {
        $$('.importance-option', importancePicker).forEach((btn) => {
            btn.classList.toggle('selected', btn.dataset.value === value);
        });
    }

    $$('.importance-option', importancePicker).forEach((btn) => {
        btn.addEventListener('click', () => {
            state.selectedImportance = btn.dataset.value;
            selectImportanceButton(btn.dataset.value);
        });
    });

    uploadLabel.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadLabel.classList.add('drag-over');
    });
    uploadLabel.addEventListener('dragleave', () => uploadLabel.classList.remove('drag-over'));
    uploadLabel.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadLabel.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            imageInput.files = e.dataTransfer.files;
            handleImagePreview();
        }
    });

    imageInput.addEventListener('change', handleImagePreview);

    function handleImagePreview() {
        const file = imageInput.files[0];
        if (!file) return;
        $('#image-error').textContent = '';
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreview.classList.remove('hidden');
            uploadPlaceholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    giftForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = $('#gift-name').value.trim();
        const hasImage = imageInput.files[0] || (state.editingId && !imagePreview.classList.contains('hidden'));

        let hasError = false;
        if (!name) hasError = true;
        if (!state.selectedImportance) hasError = true;
        if (!hasImage) {
            $('#image-error').textContent = 'La fotografía del regalo es obligatoria.';
            hasError = true;
        }
        if (hasError) {
            showToast('Falta el nombre, la foto o cuánto lo deseas, mi amor.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', $('#gift-description').value.trim());
        formData.append('purchase_link', $('#gift-link').value.trim());
        formData.append('store', $('#gift-store').value.trim());
        formData.append('importance', state.selectedImportance);
        if (imageInput.files[0]) formData.append('image', imageInput.files[0]);

        const submitBtn = $('#gift-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando con cariño...';

        try {
            const url = state.editingId ? `/api/gifts/${state.editingId}` : '/api/gifts';
            const method = state.editingId ? 'PUT' : 'POST';
            const res = await fetch(url, { method, body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Ups, algo salió mal al guardar. Inténtalo de nuevo.');

            closeModal('gift-modal');
            showToast(state.editingId ? 'Regalo actualizado con cariño 💕' : 'Nuevo deseo agregado a tu lista 💕');
            fetchGifts();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = state.editingId ? 'Guardar cambios 💕' : 'Guardar deseo 💕';
        }
    });

    // ---------- Modal: eliminar ----------

    function openDeleteModal(gift) {
        state.pendingDeleteId = gift.id;
        $('#delete-modal-text').textContent = `"${gift.name}" se irá para siempre de tu lista de deseos.`;
        openModal('delete-modal');
    }

    $('#confirm-delete-btn').addEventListener('click', async () => {
        if (!state.pendingDeleteId) return;
        const btn = $('#confirm-delete-btn');
        btn.disabled = true;
        try {
            const res = await fetch(`/api/gifts/${state.pendingDeleteId}`, { method: 'DELETE' });
            if (!res.ok && res.status !== 204) throw new Error('No pude eliminar ese deseo, inténtalo de nuevo.');
            closeModal('delete-modal');
            showToast('Listo, esa cosita ya se fue de tu lista 💕');
            fetchGifts();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.disabled = false;
            state.pendingDeleteId = null;
        }
    });

    // ---------- Modal: contraseña (entregar / revertir) ----------

    function openPasswordModal(gift, delivered) {
        state.pendingPasswordAction = { giftId: gift.id, delivered };
        $('#password-modal-title').textContent = delivered
            ? '¿Ya le diste este regalo?'
            : '¿Marcar de nuevo como pendiente?';
        $('#password-modal-text').textContent = delivered
            ? `Confirma con tu contraseña que "${gift.name}" ya es de Isela.`
            : `Confirma con tu contraseña para mover "${gift.name}" de vuelta al cofre de deseos.`;
        $('#password-input').value = '';
        $('#password-error').textContent = '';
        openModal('password-modal');
        setTimeout(() => $('#password-input').focus(), 200);
    }

    async function submitPassword() {
        if (!state.pendingPasswordAction) return;
        const { giftId, delivered } = state.pendingPasswordAction;
        const password = $('#password-input').value;

        if (!password) {
            $('#password-error').textContent = 'Escribe la contraseña, por favor.';
            return;
        }

        const btn = $('#confirm-password-btn');
        btn.disabled = true;
        try {
            const res = await fetch(`/api/gifts/${giftId}/delivery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, delivered }),
            });
            const data = await res.json();
            if (!res.ok) {
                $('#password-error').textContent = data.error || 'Esa no es la contraseña correcta, mi amor 🔒';
                $('.modal-content', $('#password-modal')).classList.add('shake');
                setTimeout(() => $('.modal-content', $('#password-modal')).classList.remove('shake'), 400);
                return;
            }
            closeModal('password-modal');
            showToast(delivered ? 'Este regalo ya vive en el corazón de Isela 💝' : 'Regalo movido de nuevo a tu cajita de deseos.');
            fetchGifts();
        } catch (err) {
            $('#password-error').textContent = 'Ocurrió un error, mi amor. Intenta de nuevo.';
        } finally {
            btn.disabled = false;
            state.pendingPasswordAction = null;
        }
    }

    $('#confirm-password-btn').addEventListener('click', submitPassword);
    $('#password-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitPassword();
        }
    });

    // ---------- Portada de bienvenida ----------
    const welcomeScreen = $('#welcome-screen');
    const welcomeBtn = $('#welcome-enter-btn');
    if (welcomeScreen && welcomeBtn) {
        document.body.classList.add('no-scroll');
        welcomeBtn.addEventListener('click', () => {
            welcomeScreen.classList.add('is-leaving');
            document.body.classList.remove('no-scroll');
            setTimeout(() => welcomeScreen.remove(), 650);
        });
    }

    // ---------- Inicio ----------
    fetchGifts();
})();
