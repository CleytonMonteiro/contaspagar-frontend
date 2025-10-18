// ========================================
//   CONFIGURAÇÕES GLOBAIS E REFERÊNCIAS
// ========================================
// URL de Produção (ONLINE) - Descomente esta linha para enviar para a web
const API_URL_BASE = 'https://contaspagar-backend-1.onrender.com/api/contas';

// URL de Desenvolvimento (LOCAL) - Use esta linha para testar no seu computador
// const API_URL_BASE = 'http://localhost:8080/api/contas';

// Pegando referências dos elementos do HTML
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
let mesSelecionadoKey = null; // Guarda qual mês está ativo (ex: '2025-10')
let resumoMensal = {}; // Guarda os totais dos meses vindos da API

// ========================================
//   FUNÇÕES AUXILIARES
// ========================================
const formatarMoeda = (valor) => (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function formatarData(timestamp) {
    // Verifica se o timestamp vindo da API tem a estrutura esperada
    if (timestamp && typeof timestamp._seconds === 'number') {
        // Converte os segundos para milissegundos
        const data = new Date(timestamp._seconds * 1000);
        // Formata a data para o padrão brasileiro, considerando UTC para evitar problemas de fuso
        return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }
    // Caso contrário, retorna um traço
    return ' - ';
}

// ========================================
//   LÓGICA PRINCIPAL DE RENDERIZAÇÃO
// ========================================

/**
 * Função principal que inicia a aplicação: busca o resumo e carrega o mês inicial.
 */
async function inicializar() {
    try {
        // 1. Busca o resumo dos meses do backend
        const responseResumo = await fetch(`${API_URL_BASE}/resumo`);
        if (!responseResumo.ok) {
            throw new Error(`Erro ao buscar resumo mensal: ${responseResumo.status}`);
        }
        resumoMensal = await responseResumo.json();

        // 2. Renderiza as abas de navegação
        renderizarAbas();

        // 3. Define qual aba carregar inicialmente (mês atual ou primeiro disponível)
        const hoje = new Date();
        const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        // Pega o primeiro mês disponível caso o mês atual não tenha contas ou não exista no resumo
        const primeiraAbaKey = Object.keys(resumoMensal).sort()[0]; 

        // Define o mês que será carregado
        mesSelecionadoKey = mesAtualKey in resumoMensal ? mesAtualKey : primeiraAbaKey;

        // 4. Carrega os dados da aba inicial (se houver algum mês)
        if (mesSelecionadoKey) {
            await carregarDadosDoMes(mesSelecionadoKey);
        } else {
            // Se não houver nenhuma conta cadastrada ainda
            abasMesesContainer.innerHTML = '<li class="nav-item"><a class="nav-link disabled">Nenhuma conta cadastrada</a></li>';
            resumoMesContainer.innerHTML = 'Nenhuma conta cadastrada.';
            tabelaContas.innerHTML = `<tr><td colspan="8">Adicione a primeira conta para começar.</td></tr>`;
            tituloTabela.innerText = 'Contas';
        }

    } catch (error) {
        // Tratamento de erro geral na inicialização
        abasMesesContainer.innerHTML = '<li class="nav-item"><a class="nav-link disabled">Erro ao carregar meses</a></li>';
        tabelaContas.innerHTML = `<tr><td colspan="8">Erro ao carregar os dados. Verifique se o backend está rodando e se os índices do Firebase foram criados.</td></tr>`;
        resumoMesContainer.innerHTML = 'Erro ao carregar dados.';
        tituloTabela.innerText = 'Erro';
        console.error('Erro na inicialização:', error);
        alert('Falha ao carregar dados iniciais. Verifique a conexão com o servidor e tente recarregar a página.\n\nDetalhes: ' + error.message);
    }
}

/**
 * Cria e renderiza as abas de navegação dos meses com base no resumo recebido.
 */
function renderizarAbas() {
    abasMesesContainer.innerHTML = ''; // Limpa as abas anteriores
    const mesesOrdenados = Object.keys(resumoMensal).sort(); // Garante a ordem cronológica

    // Se não houver meses (e não for resultado de uma busca vazia), exibe mensagem
    if (mesesOrdenados.length === 0 && !inputPesquisa.value) {
        abasMesesContainer.innerHTML = '<li class="nav-item"><a class="nav-link disabled">Nenhum mês com contas</a></li>';
        return;
    }
     // Se for resultado de uma busca vazia
    if (mesesOrdenados.length === 0 && inputPesquisa.value) {
         abasMesesContainer.innerHTML = '<li class="nav-item"><a class="nav-link disabled">Nenhum resultado para a busca</a></li>';
         return;
     }

    // Cria um link de aba para cada mês no resumo
    mesesOrdenados.forEach(mesKey => {
        const nomeMes = resumoMensal[mesKey].nome; // Ex: "outubro de 2025"
        const li = document.createElement('li');
        li.className = 'nav-item';
        // Usa data attribute para guardar a chave do mês (YYYY-MM)
        li.innerHTML = `<a class="nav-link" data-meskey="${mesKey}">${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</a>`;
        abasMesesContainer.appendChild(li);
    });
}

/**
 * Busca os dados de um mês específico (com filtro de pesquisa opcional) e renderiza.
 */
async function carregarDadosDoMes(mesKey, termoBusca = '') {
    if (!mesKey) { // Garante que temos um mês para buscar
        console.warn("Tentativa de carregar dados sem um mesKey definido.");
        return;
    }

    mesSelecionadoKey = mesKey; // Atualiza a variável global que indica o mês ativo
    const colspan = 8; // Número de colunas na tabela
    tabelaContas.innerHTML = `<tr><td colspan="${colspan}">Carregando contas de ${resumoMensal[mesKey]?.nome || mesKey}...</td></tr>`;

    // Marca a aba correspondente como ativa e desmarca as outras
    document.querySelectorAll('#abas-meses .nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.meskey === mesKey);
    });

    // Atualiza o título e o resumo do mês (pega do resumo já carregado)
    const nomeMesFormatado = resumoMensal[mesKey]?.nome.charAt(0).toUpperCase() + resumoMensal[mesKey]?.nome.slice(1) || mesKey;
    resumoMesContainer.innerHTML = `Total para ${nomeMesFormatado}: <span class="text-danger">${formatarMoeda(resumoMensal[mesKey]?.total)}</span>`;
    tituloTabela.innerText = `Contas de ${nomeMesFormatado}`;

    // Constrói a URL para a API, incluindo o mês e o termo de busca (se houver)
    let url = `${API_URL_BASE}?mes=${mesKey}`;
    if (termoBusca) {
        url += `&q=${encodeURIComponent(termoBusca)}`;
    }

    try {
        // Busca os dados das contas especificamente para este mês (e busca, se aplicável)
        const responseContas = await fetch(url);
        if (!responseContas.ok) {
            throw new Error(`Erro ${responseContas.status} ao buscar contas do mês ${mesKey}`);
        }
        const contasDoMes = await responseContas.json();

        // Renderiza a tabela com os dados recebidos
        renderizarTabela(contasDoMes);

    } catch (error) {
        tabelaContas.innerHTML = `<tr><td colspan="${colspan}">Erro ao carregar contas do mês. Verifique o backend.</td></tr>`;
        console.error('Erro ao carregar dados do mês:', error);
        alert("Falha ao carregar as contas para este mês.\n\nDetalhes: " + error.message);
    }
}

/**
 * Renderiza as linhas da tabela com uma lista de contas.
 */
function renderizarTabela(listaDeContas) {
    tabelaContas.innerHTML = ''; // Limpa a tabela
    const colspan = 8;

    // Se a lista estiver vazia, mostra mensagem apropriada
    if (listaDeContas.length === 0) {
        tabelaContas.innerHTML = `<tr><td colspan="${colspan}">Nenhuma conta encontrada para este período${inputPesquisa.value ? ' com o filtro aplicado' : ''}.</td></tr>`;
        return;
    }

    // Cria uma linha (tr) para cada conta na lista
    listaDeContas.forEach(conta => {
        const tr = document.createElement('tr');
        // Adiciona classe CSS se a conta já foi repassada (para o fundo verde)
        if (conta.repassadoFinanceiro) {
            tr.classList.add('repassado');
        }
        
        // Define o botão de Ação (Repassar ou Desfazer)
        const botaoToggle = conta.repassadoFinanceiro 
            ? `<button class="btn btn-sm btn-warning btn-toggle-repassado" data-id="${conta.id}" data-repassado="true">↩️ Desfazer</button>` 
            : `<button class="btn btn-sm btn-success btn-toggle-repassado" data-id="${conta.id}" data-repassado="false">✔️ Repassar</button>`;
        
        // Define o texto da coluna Parcela
        const textoParcela = conta.totalParcelas > 1 
            ? `${conta.parcelaAtual}/${conta.totalParcelas}` 
            : 'Única';

        // Monta o HTML interno da linha da tabela
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
        // Adiciona a linha pronta à tabela
        tabelaContas.appendChild(tr);
    });
}

// ========================================
//   EVENT LISTENERS (Interações do Usuário)
// ========================================

// Delegação de evento para cliques nas abas de meses
abasMesesContainer.addEventListener('click', (event) => {
    // Verifica se o clique foi num link de aba
    if (event.target.matches('.nav-link')) {
        const mesKey = event.target.dataset.meskey;
        inputPesquisa.value = ''; // Limpa o campo de pesquisa ao trocar de aba
        carregarDadosDoMes(mesKey); // Carrega os dados do mês clicado
    }
});

// Event listener para o envio do formulário de pesquisa
formPesquisa.addEventListener('submit', (event) => {
    event.preventDefault(); // Impede o recarregamento da página
    if (mesSelecionadoKey) { // Só permite pesquisar se um mês estiver ativo
        const termoBusca = inputPesquisa.value;
        // Chama a função para carregar dados, passando o mês atual e o termo de busca
        carregarDadosDoMes(mesSelecionadoKey, termoBusca);
    } else {
        alert("Selecione um mês antes de pesquisar.");
    }
});

// Event listener para o botão de limpar pesquisa
btnLimparPesquisa.addEventListener('click', () => {
    inputPesquisa.value = ''; // Limpa o campo
    if (mesSelecionadoKey) { // Recarrega os dados do mês atual sem o filtro
        carregarDadosDoMes(mesSelecionadoKey);
    }
});

// Event listener para o envio do formulário de nova conta
formNovaConta.addEventListener('submit', async (event) => {
    event.preventDefault(); // Impede o recarregamento
    // Coleta os dados do formulário
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
        // Envia os dados para o backend via POST
        const response = await fetch(API_URL_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(conta),
        });

        // Tratamento específico para erro de duplicidade (409)
        if (response.status === 409) {
            const errorData = await response.json();
            alert(errorData.message); // Exibe a mensagem vinda do backend
            return; // Interrompe
        }

        // Tratamento para outros erros de resposta do servidor
        if (!response.ok) {
            throw new Error('Erro na resposta do servidor: ' + response.status);
        }
        
        // Se tudo deu certo:
        alert('Conta adicionada com sucesso!'); // Feedback para o usuário
        formNovaConta.reset(); // Limpa o formulário
        inicializar(); // Re-inicializa TUDO para atualizar o resumo mensal e as abas
    } catch (error) {
        // Tratamento de erros de rede ou outros erros
        console.error('Erro ao adicionar conta:', error);
        alert('Ocorreu um erro ao tentar adicionar a conta:\n\n' + error.message);
    }
});

// Delegação de evento para cliques nos botões dentro da tabela (Repassar/Desfazer, Excluir)
tabelaContas.addEventListener('click', async (event) => {
    const elementoClicado = event.target; // O botão que foi clicado
    const contaId = elementoClicado.dataset.id; // O ID da conta associado ao botão
    let acaoRealizada = false; // Flag para saber se precisamos recarregar os dados
    let precisaRecarregarResumo = false; // Flag para saber se a ação afeta o resumo mensal

    // Lógica para o botão Repassar/Desfazer
    if (elementoClicado.classList.contains('btn-toggle-repassado')) {
        const statusAtual = elementoClicado.dataset.repassado === 'true'; // Verifica o estado atual pelo data attribute
        const novoStatus = !statusAtual; // Inverte o estado
        try {
            // Envia a requisição PUT para o backend com o novo estado
            const response = await fetch(`${API_URL_BASE}/${contaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repassado: novoStatus }) // Envia { "repassado": true } ou { "repassado": false }
            });
            if (!response.ok) throw new Error('Erro ao atualizar conta');
            acaoRealizada = true; // Marca que a ação foi bem sucedida
            // Mudar o status não afeta o total do mês, então não precisa recarregar o resumo
        } catch (error) {
            console.error('Erro ao repassar/desfazer conta:', error);
            alert('Não foi possível atualizar o status da conta.');
        }
    }

    // Lógica para o botão Excluir
    if (elementoClicado.classList.contains('btn-excluir')) {
        const totalParcelas = parseInt(elementoClicado.dataset.totalParcelas, 10);
        let mensagem = 'Tem certeza que deseja excluir esta conta?';
        // Personaliza a mensagem se for uma conta parcelada
        if (totalParcelas > 1) {
            mensagem = `Esta é uma conta parcelada (${totalParcelas}x). Excluir esta parcela irá remover TODAS as outras do mesmo grupo. Deseja continuar?`;
        }

        // Pede confirmação ao usuário
        if (confirm(mensagem)) {
            try {
                // Envia a requisição DELETE para o backend
                const response = await fetch(`${API_URL_BASE}/${contaId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Erro ao excluir conta');
                acaoRealizada = true; // Marca que a ação foi bem sucedida
                precisaRecarregarResumo = true; // Excluir afeta o total, precisa recarregar tudo
            } catch (error) {
                console.error('Erro ao excluir conta:', error);
                alert('Não foi possível excluir a conta.');
            }
        }
    }

    // Após uma ação bem sucedida, decide como recarregar os dados
    if (acaoRealizada) {
        if (precisaRecarregarResumo) {
            inicializar(); // Recarrega tudo (resumo + mês) se a ação afetou os totais
        } else if (mesSelecionadoKey) {
            // Recarrega apenas os dados do mês atual, mantendo o filtro de busca se houver
            carregarDadosDoMes(mesSelecionadoKey, inputPesquisa.value); 
        }
    }
});

// Event listener para o botão de Impressão
btnImprimir.addEventListener('click', () => {
    window.print(); // Chama a função de impressão do navegador
});

// ========================================
//   INICIALIZAÇÃO DA PÁGINA
// ========================================
// Quando o HTML da página terminar de carregar, chama a função inicializar
document.addEventListener('DOMContentLoaded', inicializar);