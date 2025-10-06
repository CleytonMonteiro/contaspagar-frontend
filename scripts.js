// ========================================
//   CONFIGURAÇÕES GLOBAIS E REFERÊNCIAS
// ========================================
// URL de Produção (ONLINE)
const API_URL = 'https://contaspagar-backend-1.onrender.com/api/contas';

// URL de Desenvolvimento (LOCAL)
//const API_URL = 'http://localhost:8080/api/contas';

// Referências aos elementos do HTML
const tabelaContas = document.getElementById('tabela-contas');
const formNovaConta = document.getElementById('form-nova-conta');
const btnImprimir = document.getElementById('btn-imprimir');
const formPesquisa = document.getElementById('form-pesquisa');
const inputPesquisa = document.getElementById('input-pesquisa');
const btnLimparPesquisa = document.getElementById('btn-limpar-pesquisa');
const abasMesesContainer = document.getElementById('abas-meses');
const resumoMesContainer = document.getElementById('resumo-mes');
const tituloTabela = document.getElementById('titulo-tabela');

// Variáveis de estado
let todasAsContas = [];
let dadosPorMes = {};

// ========================================
//   FUNÇÕES AUXILIARES
// ========================================
const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function formatarData(timestamp) {
    if (timestamp && typeof timestamp._seconds === 'number') {
        const data = new Date(timestamp._seconds * 1000);
        return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }
    return ' - ';
}

// ========================================
//   LÓGICA PRINCIPAL DE RENDERIZAÇÃO
// ========================================

async function inicializar() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Erro ao buscar dados da API');
        todasAsContas = await response.json();
        processarErenderizar(todasAsContas);
    } catch (error) {
        tabelaContas.innerHTML = `<tr><td colspan="8">Erro ao carregar os dados. Verifique se o backend está rodando.</td></tr>`;
        console.error('Erro na inicialização:', error);
    }
}

function processarErenderizar(listaDeContas) {
    dadosPorMes = listaDeContas.reduce((acc, conta) => {
        if (!conta.dataVencimento || !conta.dataVencimento._seconds) return acc;
        const data = new Date(conta.dataVencimento._seconds * 1000);
        const mesKey = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        if (!acc[mesKey]) {
            acc[mesKey] = { contas: [], total: 0, nome: data.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) };
        }
        acc[mesKey].contas.push(conta);
        acc[mesKey].total += conta.valorPagar;
        return acc;
    }, {});
    renderizarAbas();
    const hoje = new Date();
    const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const primeiraAbaKey = Object.keys(dadosPorMes).sort()[0];
    renderizarDadosDoMes(mesAtualKey in dadosPorMes ? mesAtualKey : primeiraAbaKey);
}

function renderizarAbas() {
    abasMesesContainer.innerHTML = '';
    const mesesOrdenados = Object.keys(dadosPorMes).sort();
    if (mesesOrdenados.length === 0 && inputPesquisa.value) {
        abasMesesContainer.innerHTML = '<li class="nav-item"><a class="nav-link disabled">Nenhum resultado para a busca</a></li>';
        return;
    }
    mesesOrdenados.forEach(mesKey => {
        const nomeMes = dadosPorMes[mesKey].nome;
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML = `<a class="nav-link" data-meskey="${mesKey}">${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</a>`;
        abasMesesContainer.appendChild(li);
    });
}

function renderizarDadosDoMes(mesKey) {
    if (!mesKey || !dadosPorMes[mesKey]) {
        resumoMesContainer.innerHTML = 'Nenhuma conta para o período selecionado.';
        tabelaContas.innerHTML = `<tr><td colspan="8">Selecione um mês ou limpe a busca.</td></tr>`;
        tituloTabela.innerText = 'Contas';
        return;
    }
    document.querySelectorAll('#abas-meses .nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.meskey === mesKey);
    });
    const dadosDoMes = dadosPorMes[mesKey];
    const nomeMesFormatado = dadosDoMes.nome.charAt(0).toUpperCase() + dadosDoMes.nome.slice(1);
    resumoMesContainer.innerHTML = `Total para ${nomeMesFormatado}: <span class="text-danger">${formatarMoeda(dadosDoMes.total)}</span>`;
    tituloTabela.innerText = `Contas de ${nomeMesFormatado}`;
    tabelaContas.innerHTML = '';
    if (dadosDoMes.contas.length === 0) {
        tabelaContas.innerHTML = `<tr><td colspan="8">Nenhuma conta encontrada para este mês.</td></tr>`;
        return;
    }
    dadosDoMes.contas.forEach(conta => {
        const tr = document.createElement('tr');
        if (conta.repassadoFinanceiro) tr.classList.add('repassado');
        const botaoToggle = conta.repassadoFinanceiro ? `<button class="btn btn-sm btn-warning btn-toggle-repassado" data-id="${conta.id}" data-repassado="true">↩️ Desfazer</button>` : `<button class="btn btn-sm btn-success btn-toggle-repassado" data-id="${conta.id}" data-repassado="false">✔️ Repassar</button>`;
        const textoParcela = conta.totalParcelas > 1 ? `${conta.parcelaAtual}/${conta.totalParcelas}` : 'Única';
        tr.innerHTML = `
            <td>${formatarData(conta.dataVencimento)}</td>
            <td class="col-fornecedor">${conta.fornecedor}</td>
            <td class="col-historico">${conta.historico}</td>
            <td>${conta.notaFiscal || '-'}</td>
            <td>${textoParcela}</td>
            <td>${formatarMoeda(conta.valorPagar)}</td>
            <td>${conta.repassadoFinanceiro ? 'Repassado' : 'Pendente'}</td>
            <td>
                ${botaoToggle}
                <button class="btn btn-sm btn-danger btn-excluir" data-id="${conta.id}" data-total-parcelas="${conta.totalParcelas}">❌ Excluir</button>
            </td>
        `;
        tabelaContas.appendChild(tr);
    });
}

// ========================================
//   EVENT LISTENERS
// ========================================

abasMesesContainer.addEventListener('click', (event) => {
    if (event.target.matches('.nav-link')) {
        renderizarDadosDoMes(event.target.dataset.meskey);
    }
});

formPesquisa.addEventListener('submit', (event) => {
    event.preventDefault();
    const termoBusca = inputPesquisa.value.toLowerCase();
    const contasFiltradas = todasAsContas.filter(conta =>
        (conta.fornecedor || '').toLowerCase().includes(termoBusca) ||
        (conta.historico || '').toLowerCase().includes(termoBusca) ||
        (conta.notaFiscal || '').toLowerCase().includes(termoBusca)
    );
    processarErenderizar(contasFiltradas);
});

btnLimparPesquisa.addEventListener('click', () => {
    inputPesquisa.value = '';
    processarErenderizar(todasAsContas);
});

formNovaConta.addEventListener('submit', async (event) => {
    event.preventDefault();
    const conta = {
        fornecedor: document.getElementById('fornecedor').value,
        historico: document.getElementById('historico').value,
        valorPagar: document.getElementById('valorPagar').value,
        dataVencimento: document.getElementById('dataVencimento').value,
        dataEmissao: document.getElementById('dataEmissao').value,
        notaFiscal: document.getElementById('notaFiscal').value,
        numeroParcelas: document.getElementById('numeroParcelas').value
    };
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(conta),
        });
        if (response.status === 409) {
            const errorData = await response.json();
            alert(errorData.message);
            return;
        }
        if (!response.ok) {
            throw new Error('Erro na resposta do servidor: ' + response.status);
        }
        alert('Conta adicionada com sucesso!');
        formNovaConta.reset();
        inicializar();
    } catch (error) {
        console.error('Erro ao adicionar conta:', error);
        alert('Ocorreu um erro ao tentar adicionar a conta:\n\n' + error.message);
    }
});

tabelaContas.addEventListener('click', async (event) => {
    const elementoClicado = event.target;
    const contaId = elementoClicado.dataset.id;
    let acaoRealizada = false;
    
    if (elementoClicado.classList.contains('btn-toggle-repassado')) {
        const statusAtual = elementoClicado.dataset.repassado === 'true';
        const novoStatus = !statusAtual;
        try {
            const response = await fetch(`${API_URL}/${contaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repassado: novoStatus })
            });
            if (!response.ok) throw new Error('Erro ao atualizar conta');
            acaoRealizada = true;
        } catch (error) {
            console.error('Erro ao repassar/desfazer conta:', error);
            alert('Não foi possível atualizar a conta.');
        }
    }

    if (elementoClicado.classList.contains('btn-excluir')) {
        const totalParcelas = parseInt(elementoClicado.dataset.totalParcelas, 10);
        let mensagem = 'Tem certeza que deseja excluir esta conta?';

        if (totalParcelas > 1) {
            mensagem = `Esta é uma conta parcelada (${totalParcelas}x). Excluir esta parcela irá remover TODAS as outras do mesmo grupo. Deseja continuar?`;
        }

        if (confirm(mensagem)) {
            try {
                const response = await fetch(`${API_URL}/${contaId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Erro ao excluir conta');
                acaoRealizada = true;
            } catch (error) {
                console.error('Erro ao excluir conta:', error);
                alert('Não foi possível excluir a conta.');
            }
        }
    }

    if (acaoRealizada) inicializar();
});

btnImprimir.addEventListener('click', () => window.print());

document.addEventListener('DOMContentLoaded', inicializar);