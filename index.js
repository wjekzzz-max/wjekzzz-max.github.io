import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase 설정: 아래 두 값을 본인 프로젝트 값으로 변경하세요.
const SUPABASE_URL = window.SUPABASE_URL || 'https://ukzyflvgnagekrlxfsdp.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrenlmbHZnbmFnZWtybHhmc2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4ODUxOTEsImV4cCI6MjA3NzQ2MTE5MX0.OOZhNNJN4zeKC10vHcSC9JWtbxzzz514jbOOcRCqDBA';

// 전역 상태
const state = {
    supabase: null,
    session: null,
    pendingReportTarget: null,
};

// 초기화
async function initApp() {
    // 연도 표기
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    // Supabase 클라이언트
    state.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await state.supabase.auth.getSession();
    state.session = data.session;

    setupAuthUI();
    setupRouting();
}

function setupAuthUI() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const authDialog = document.getElementById('authDialog');
    const authClose = document.getElementById('authClose');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const authForm = document.getElementById('authForm');
    const authTitle = document.getElementById('authTitle');
    const authSubmit = document.getElementById('authSubmit');
    const authPassword2Input = document.getElementById('authPassword2');

    let isSignup = false;

    function updateButtons() {
        if (state.session) {
            loginBtn.style.display = 'none';
            logoutBtn.style.display = '';
        } else {
            loginBtn.style.display = '';
            logoutBtn.style.display = 'none';
        }
    }
    updateButtons();

    loginBtn.addEventListener('click', () => {
        isSignup = false;
        authTitle.textContent = '로그인';
        authSubmit.textContent = '로그인';
        toggleAuthMode.textContent = '회원가입';
        authDialog.showModal();
    });
    logoutBtn.addEventListener('click', async () => {
        await state.supabase.auth.signOut();
        state.session = null;
        updateButtons();
        navigateTo('#/');
    });
    authClose.addEventListener('click', () => authDialog.close());
    toggleAuthMode.addEventListener('click', () => {
        isSignup = !isSignup;
        authTitle.textContent = isSignup ? '회원가입' : '로그인';
        authSubmit.textContent = isSignup ? '회원가입' : '로그인';
        toggleAuthMode.textContent = isSignup ? '로그인으로' : '회원가입';
    });
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        const password2 = authPassword2Input.value;
        if (!email || !password) return;
        // 회원가입일 때는 반드시 비밀번호 확인 일치 필요
        if (isSignup) {
            if (!password2) { alert('비밀번호 확인을 입력하세요.'); return; }
            if (password !== password2) { alert('비밀번호가 일치하지 않습니다.'); return; }
        } else {
            // 로그인일 때 비밀번호 확인이 입력되어 있으면 일치 검증, 비어있으면 무시
            if (password2 && password !== password2) { alert('비밀번호가 일치하지 않습니다.'); return; }
        }
        try {
            if (isSignup) {
                const { data: signUpData, error: signUpError } = await state.supabase.auth.signUp({ email, password });
                if (signUpError) throw signUpError;
                // 일부 설정에서는 즉시 세션이 생기지 않고 이메일 확인이 필요함
                if (signUpData.session) {
                    state.session = signUpData.session;
                    try { await ensureProfile(); } catch(_) {}
                    authDialog.close();
                    updateButtons();
                    navigateTo('#/');
                } else {
                    // 이메일 확인이 필요한 경우 자동 로그인 시도
                    const { data: signInData, error: signInError } = await state.supabase.auth.signInWithPassword({ email, password });
                    if (signInError) {
                        alert(signInError.message || '회원가입 완료. 이메일 확인 후 다시 로그인해주세요.');
                        isSignup = false;
                        authTitle.textContent = '로그인';
                        authSubmit.textContent = '로그인';
                        toggleAuthMode.textContent = '회원가입';
                    } else {
                        state.session = signInData.session;
                        try { await ensureProfile(); } catch(_) {}
                        authDialog.close();
                        updateButtons();
                        navigateTo('#/');
                    }
                }
            } else {
                const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                state.session = data.session;
                try { await ensureProfile(); } catch(_) {}
                authDialog.close();
                updateButtons();
                navigateTo('#/');
            }
        } catch (err) {
            alert(err?.message || '오류가 발생했습니다.');
        }
    });

    state.supabase.auth.onAuthStateChange(async (_event, session) => {
        state.session = session;
        updateButtons();
        if (session?.user) {
            try { await ensureProfile(); } catch (_) {}
        }
    });
}

// 라우팅
const routes = {
    '#/': renderHome,
    '#/requests': renderRequests,
    '#/new-request': renderNewRequest,
    '#/profile': renderProfile,
    '#/customer': renderCustomer,
    '#/report': renderReport,
};

function setupRouting() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
}

function navigateTo(hash) {
    if (location.hash !== hash) {
        location.hash = hash;
    } else {
        handleRoute();
    }
}

function handleRoute() {
    const app = document.getElementById('app');
    const hash = location.hash || '#/';
    const page = routes[hash] || routes['#/'];
    page(app).catch((e) => {
        app.innerHTML = `<div class="card"><h3>오류</h3><p class="muted">${e?.message || '알 수 없는 오류'}</p></div>`;
    });
}

// 홈
async function renderHome(root) {
    const user = state.session?.user;
    root.innerHTML = `
    <section class="grid cols-2">
      <div class="card">
        <h3>의뢰 찾기</h3>
        <p class="muted">검색과 필터를 사용해 원하는 의뢰를 찾아보세요.</p>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="goRequests">의뢰 리스트 보기</button>
      </div>
      <div class="card">
        <h3>${user ? '환영합니다!' : '로그인이 필요합니다'}</h3>
        <p class="muted">${user ? user.email : '프로필, 리뷰 작성은 로그인 후 이용할 수 있어요.'}</p>
      </div>
    </section>
  `;
    document.getElementById('goRequests').addEventListener('click', () => navigateTo('#/requests'));
}

// 의뢰 리스트 + 검색/필터
async function renderRequests(root) {
    const q = new URLSearchParams(location.search);
    root.innerHTML = `
    <div class="card">
      <div class="row wrap">
        <div class="field" style="min-width:220px;flex:1">
          <label for="search">검색</label>
          <input id="search" placeholder="제목, 내용으로 검색" value="${q.get('q') || ''}">
        </div>
        <div class="field" style="min-width:160px">
          <label for="category">카테고리</label>
          <select id="category">
            <option value="">전체</option>
            <option>디자인</option>
            <option>개발</option>
            <option>번역</option>
            <option>컨설팅</option>
          </select>
        </div>
        <div class="field" style="min-width:160px">
          <label for="minRating">최소 평점</label>
          <select id="minRating">
            <option value="">상관없음</option>
            <option value="5">5.0</option>
            <option value="4">4.0+</option>
            <option value="3">3.0+</option>
          </select>
        </div>
        <span class="space"></span>
        <button class="btn btn-primary" id="applyFilters">검색</button>
      </div>
    </div>
    <div class="spacer"></div>
    <div class="list" id="requestList"></div>
  `;

    document.getElementById('applyFilters').addEventListener('click', () => loadRequests());
    document.getElementById('search').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            loadRequests();
        }
    });
    await loadRequests();

    async function loadRequests() {
        const search = document.getElementById('search').value.trim();
        const category = document.getElementById('category').value;
        const minRating = document.getElementById('minRating').value;

        let query = state.supabase.from('requests_view').select('*').order('created_at', { ascending: false }).limit(50);
        if (search) {
            const encoded = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
            query = query.or(`title.ilike.%${encoded}%,summary.ilike.%${encoded}%`);
        }
        if (category) {
            query = query.eq('category', category);
        }
        if (minRating) {
            query = query.gte('avg_rating', Number(minRating));
        }

        const { data, error } = await query;
        const list = document.getElementById('requestList');
        if (error) {
            list.innerHTML = `<div class="card"><p class="muted">불러오기 실패: ${error.message}</p></div>`;
            return;
        }
        if (!data || data.length === 0) {
            list.innerHTML = `<div class="card"><p class="muted">결과가 없습니다.</p></div>`;
            return;
        }
        // 작성자 핸들 조회
        let handlesByUserId = {};
        try {
            const ids = Array.from(new Set(data.map((d) => d.owner_user_id))).filter(Boolean);
            if (ids.length) {
                const { data: profs } = await state.supabase.from('profiles').select('user_id, handle').in('user_id', ids);
                (profs || []).forEach(p => { if (p.handle) handlesByUserId[p.user_id] = p.handle; });
            }
        } catch(_) {}
        list.innerHTML = data.map((item) => renderRequestItem(item, handlesByUserId)).join('');
        document.querySelectorAll('[data-action="review"]').forEach((btn) => btn.addEventListener('click', onClickReview));
        document.querySelectorAll('[data-action="report-user"]').forEach((btn) => btn.addEventListener('click', onClickReportUser));
        document.querySelectorAll('[data-action="delete"]').forEach((btn) => btn.addEventListener('click', onClickDelete));
    }

    function renderRequestItem(item, handlesByUserId) {
        const rating = item.avg_rating ? Number(item.avg_rating).toFixed(1) : '-';
        const isOwner = !!state.session && state.session.user.id === item.owner_user_id;
        const handle = handlesByUserId?.[item.owner_user_id] || (item.owner_user_id ? item.owner_user_id.slice(0,8) : '-');
        return `
      <div class="list-item">
        <div>
          <h4 style="margin:0 0 4px">${escapeHtml(item.title)}</h4>
          <div class="muted" style="margin-bottom:6px">${escapeHtml(item.summary || '')}</div>
          <div class="row" style="gap:8px">
            <span class="chip">${escapeHtml(item.category || '기타')}</span>
            <span class="chip"><span class="rating">★</span> ${rating}</span>
            <span class="chip">작성자: ${escapeHtml(handle)}</span>
          </div>
        </div>
        <div class="row">
          <button class="btn" data-action="review" data-user-id="${item.owner_user_id}">리뷰 남기기</button>
          <button class="btn" data-action="report-user" data-user-id="${item.owner_user_id}" data-user-handle="${handle}">작성자 신고</button>
          ${isOwner ? `<button class="btn" data-action="delete" data-id="${item.id}">삭제</button>` : ''}
        </div>
      </div>
    `;
    }

    function onClickReview(e) {
        if (!state.session) {
            alert('로그인이 필요합니다');
            return;
        }
        const reviewedUserId = e.currentTarget.getAttribute('data-user-id');
        openReviewDialog(reviewedUserId);
    }

    function onClickReportUser(e) {
        const h = e.currentTarget.getAttribute('data-user-handle');
        const target = h || e.currentTarget.getAttribute('data-user-id');
        state.pendingReportTarget = target;
        navigateTo('#/report');
    }

    async function onClickDelete(e) {
        if (!state.session) {
            alert('로그인이 필요합니다');
            return;
        }
        const id = e.currentTarget.getAttribute('data-id');
        if (!id) return;
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const { error } = await state.supabase
            .from('requests')
            .delete()
            .eq('id', id)
            .eq('owner_user_id', state.session.user.id)
            .select('id');
        if (error) {
            alert('삭제 실패: ' + error.message);
            return;
        }
        // 오류 없으면 성공으로 간주하고 목록 새로고침
        await loadRequests();
    }
}

// 의뢰 작성 (로그인 필요)
async function renderNewRequest(root) {
    if (!state.session) {
        root.innerHTML = `<div class="card"><h3>로그인이 필요합니다</h3><p class="muted">의뢰 작성은 로그인 후 이용할 수 있어요.</p></div>`;
        return;
    }
    root.innerHTML = `
    <div class="card">
      <h3>의뢰 작성</h3>
      <div class="grid">
        <div class="field">
          <label>제목</label>
          <input id="reqTitle" placeholder="예: 로고 디자인 의뢰">
        </div>
        <div class="field">
          <label>카테고리</label>
          <select id="reqCategory">
            <option value="">선택</option>
            <option>디자인</option>
            <option>개발</option>
            <option>번역</option>
            <option>컨설팅</option>
          </select>
        </div>
        <div class="field">
          <label>요약</label>
          <textarea id="reqSummary" placeholder="간단한 요구사항을 적어주세요"></textarea>
        </div>
        <div class="row" style="justify-content:flex-end;gap:8px">
          <button class="btn" id="cancelNewReq">취소</button>
          <button class="btn btn-primary" id="submitNewReq">등록</button>
        </div>
      </div>
    </div>
  `;

    document.getElementById('cancelNewReq').addEventListener('click', () => navigateTo('#/requests'));
    document.getElementById('submitNewReq').addEventListener('click', submitNewRequest);

    async function submitNewRequest() {
        const title = document.getElementById('reqTitle').value.trim();
        const category = document.getElementById('reqCategory').value.trim();
        const summary = document.getElementById('reqSummary').value.trim();
        if (!title || !category) {
            alert('제목과 카테고리를 입력하세요.');
            return;
        }
        const payload = {
            owner_user_id: state.session.user.id,
            title,
            summary,
            category,
        };
        const { error } = await state.supabase.from('requests').insert(payload);
        if (error) {
            alert('등록 실패: ' + error.message);
            return;
        }
        alert('의뢰가 등록되었습니다.');
        navigateTo('#/requests');
    }
}

// 프로필 (본인 평균 평점, 받은 리뷰)
async function renderProfile(root) {
    if (!state.session) {
        root.innerHTML = `<div class="card"><h3>로그인이 필요합니다</h3><p class="muted">프로필 페이지는 로그인 후 이용할 수 있어요.</p></div>`;
        return;
    }
    const userId = state.session.user.id;
    const { data: profile, error: pErr } = await state.supabase
        .from('user_profiles_view')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (pErr) {
        root.innerHTML = `<div class="card"><p class="muted">프로필 로딩 실패: ${pErr.message}</p></div>`;
        return;
    }

    const { data: reviews, error: rErr } = await state.supabase
        .from('reviews_view')
        .select('*')
        .eq('reviewed_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
    if (rErr) {
        root.innerHTML = `<div class="card"><p class="muted">리뷰 로딩 실패: ${rErr.message}</p></div>`;
        return;
    }

    const avg = profile?.avg_rating ? Number(profile.avg_rating).toFixed(1) : '-';
    root.innerHTML = `
    <section class="grid cols-2">
      <div class="card">
        <h3>내 프로필</h3>
        <div class="row" style="gap:10px">
          <span class="chip">${escapeHtml(state.session.user.email)}</span>
          <span class="chip"><span class="rating">★</span> ${avg}</span>
        </div>
      </div>
      <div class="card">
        <h3>리뷰 남기기</h3>
        <p class="muted">사용자 ID로 리뷰를 남길 수 있습니다.</p>
        <div class="row" style="gap:8px">
          <input id="reviewTarget" placeholder="리뷰 대상 사용자 ID" style="flex:1" />
          <button class="btn" id="openReview">리뷰 작성</button>
        </div>
      </div>
    </section>
    <div class="spacer"></div>
    <div class="card">
      <h3>받은 리뷰</h3>
      <div class="list">${(reviews || []).map(renderReviewItem).join('') || '<p class="muted">아직 리뷰가 없습니다.</p>'}</div>
    </div>
  `;

    document.getElementById('openReview').addEventListener('click', () => {
        const id = document.getElementById('reviewTarget').value.trim();
        if (!id) return;
        openReviewDialog(id);
    });

    function renderReviewItem(rv) {
        return `
      <div class="list-item">
        <div>
          <div><span class="rating">★</span> ${Number(rv.rating).toFixed(1)} · <span class="muted">by ${escapeHtml(rv.reviewer_email || rv.reviewer_user_id)}</span></div>
          <div class="muted">${escapeHtml(rv.comment || '')}</div>
        </div>
        <div class="muted" style="font-size:12px">${new Date(rv.created_at).toLocaleString()}</div>
      </div>
    `;
    }
}

// 고객센터 (티켓 생성)
async function renderCustomer(root) {
    if (!state.session) {
        root.innerHTML = `<div class="card"><h3>로그인이 필요합니다</h3><p class="muted">고객센터 문의는 로그인 후 이용할 수 있어요.</p></div>`;
        return;
    }
    root.innerHTML = `
    <div class="card">
      <h3>고객센터 문의</h3>
      <div class="grid">
        <div class="field">
          <label>이메일</label>
          <input id="ticketEmail" placeholder="답변 받을 이메일" value="${state.session?.user?.email || ''}">
        </div>
        <div class="field">
          <label>제목</label>
          <input id="ticketTitle" placeholder="문의 제목">
        </div>
        <div class="field">
          <label>내용</label>
          <textarea id="ticketBody" placeholder="자세한 내용을 적어주세요"></textarea>
        </div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn btn-primary" id="submitTicket">문의 보내기</button>
        </div>
      </div>
    </div>
  `;

    document.getElementById('submitTicket').addEventListener('click', async () => {
        if (!state.session) { alert('로그인이 필요합니다'); return; }
        const email = document.getElementById('ticketEmail').value.trim();
        const title = document.getElementById('ticketTitle').value.trim();
        const body = document.getElementById('ticketBody').value.trim();
        if (!email || !title || !body) return alert('모든 항목을 입력하세요.');
        const { error } = await state.supabase.from('tickets').insert({ email, title, body });
        if (error) return alert('등록 실패: ' + error.message);
        alert('문의가 접수되었습니다.');
        navigateTo('#/');
    });
}

// 신고 (간단)
async function renderReport(root) {
    if (!state.session) {
        root.innerHTML = `<div class="card"><h3>로그인이 필요합니다</h3><p class="muted">신고 기능은 로그인 후 이용할 수 있어요.</p></div>`;
        return;
    }
    root.innerHTML = `
    <div class="card">
      <h3>신고하기</h3>
      <div class="grid">
        <div class="field">
          <label>대상 ID (사용자 또는 의뢰)</label>
          <input id="reportTarget" placeholder="예: user_abc 또는 req_123">
        </div>
        <div class="field">
          <label>사유</label>
          <textarea id="reportReason" placeholder="간단한 신고 사유"></textarea>
        </div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn btn-primary" id="submitReport">신고 제출</button>
        </div>
      </div>
    </div>
  `;

    // 작성자 신고 버튼에서 넘어온 값 채우기
    if (state.pendingReportTarget) {
        const input = document.getElementById('reportTarget');
        input.value = state.pendingReportTarget;
        state.pendingReportTarget = null;
    }

    document.getElementById('submitReport').addEventListener('click', async () => {
        if (!state.session) { alert('로그인이 필요합니다'); return; }
        const target = document.getElementById('reportTarget').value.trim();
        const reason = document.getElementById('reportReason').value.trim();
        if (!target || !reason) return alert('모든 항목을 입력하세요.');
        const { error } = await state.supabase.from('reports').insert({ target, reason });
        if (error) return alert('제출 실패: ' + error.message);
        alert('신고가 접수되었습니다. 감사합니다.');
        navigateTo('#/');
    });
}

// 리뷰 작성 다이얼로그 (간단 프롬프트)
async function openReviewDialog(reviewedUserId) {
    if (!state.session) {
        alert('로그인이 필요합니다');
        return;
    }
    const ratingStr = prompt('평점 (1~5):', '5');
    if (!ratingStr) return;
    const rating = Math.min(5, Math.max(1, Number(ratingStr)));
    const comment = prompt('코멘트 (선택):', '') || '';
    const { error } = await state.supabase.from('reviews').insert({
        reviewed_user_id: reviewedUserId,
        reviewer_user_id: state.session.user.id,
        rating,
        comment,
    });
    if (error) return alert('리뷰 등록 실패: ' + error.message);
    alert('리뷰가 등록되었습니다.');
}

// 유틸
function escapeHtml(str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// 프로필(핸들) 보장: 없으면 한 번 입력 받아 저장
async function ensureProfile() {
    const uid = state.session?.user?.id;
    if (!uid) return;
    try {
        const { data: prof } = await state.supabase.from('profiles').select('user_id, handle').eq('user_id', uid).maybeSingle();
        if (prof && prof.handle) return;
    } catch (_) {
        // 프로필 테이블이 없으면 무시
        return;
    }

    // 간단한 핸들 입력
    let handle = '';
    for (let i=0; i<3; i++) {
        handle = prompt('표시할 아이디(영문/숫자/밑줄, 3~20자):', '') || '';
        if (!handle) return; // 사용자가 취소한 경우
        if (!/^[-_a-zA-Z0-9]{3,20}$/.test(handle)) { alert('형식이 올바르지 않습니다.'); continue; }
        const { error } = await state.supabase.from('profiles').upsert({ user_id: uid, handle }, { onConflict: 'user_id' });
        if (error) { alert(error.message || '저장 실패'); continue; }
        break;
    }
}

// 시작
window.addEventListener('DOMContentLoaded', initApp);


