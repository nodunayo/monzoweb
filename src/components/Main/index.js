import React from 'react';
import AccountInfo from 'components/AccountInfo';
import TransactionList from 'components/TransactionList';
import TransactionSummary from 'components/TransactionSummary';
import { browserHistory } from 'react-router';
import { once, ajaxFail, checkStatus, intToAmount } from 'lib/utils';
import 'whatwg-fetch';

export default class Main extends React.Component {
  constructor() {
    super();

    // Lazy init sidebar & date
    this.initSideMenu = once(this.initSideMenu);

    // Bind property functions
    this.transactionSearch = this.transactionSearch.bind(this);
    this.transactionSelect = this.transactionSelect.bind(this);

    this.state = {
      active: 0,
      id: undefined,
      name: '',
      transactions: [],
      filterActive: false,
      filteredTransactions: [],
      balance: '',
      currency: '',
      spentToday: ''
    };
  }

  componentWillMount() {
    this.initialLoad();
  }

  initialLoad() {
    // Retrieve inital data
    this.retrieveAccount().then(() => {
      this.retrieveBalance();
      this.retrieveTransactions();
    });
  }

  // Updates the state with the latest balance
  retrieveBalance() {
    fetch(`https://api.getmondo.co.uk/balance?account_id=${this.state.id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.monzo_access_token}`
      }
    })
    .then(checkStatus)
    .then(response => response.json())
    .then(account => {
      const { currency, balance, spend_today: spentToday} = account;
      this.setState({
        balance, spentToday, currency
      });
    })
    .catch(error => ajaxFail(error, this.initialLoad.bind(this)));
  }

  // Updates the state with the account name (only first account supported atm)
  retrieveAccount() {
    return new Promise(resolve => {
      fetch('https://api.getmondo.co.uk/accounts', {
        headers: {
          'Authorization': `Bearer ${localStorage.monzo_access_token}`
        }
      })
      .then(checkStatus)
      .then(response => response.json())
      .then(response => {
        this.setState({
          name: response.accounts[0].description,
          id: response.accounts[0].id
        });
        resolve();
      })
      .catch(error => ajaxFail(error, this.initialLoad.bind(this)));
    });
  }

  processTransactionsData(transactions) {
    transactions = transactions.map(transaction => {

      let title = '';

      if (transaction.counterparty && typeof transaction.counterparty.name !== 'undefined') {
        title = transaction.counterparty.name;
      } else if (transaction.merchant && typeof transaction.merchant.name !== 'undefined') {
        title = transaction.merchant.name;
      } else if (transaction.is_load) {
        title = 'Monzo';
      }

      const amount = intToAmount(transaction.amount, transaction.currency);

      let localAmount = false;

      if (transaction.local_currency !== this.state.currency) {
        localAmount = intToAmount(transaction.local_amount, transaction.local_currency);
      }

      return {
        ...transaction,
        title,
        amount,
        localAmount
      };
    });

    return transactions;
  }

  // Params is a query string starting with '&'
  retrieveTransactions(params = '') {
    fetch(`https://api.getmondo.co.uk/transactions?expand[]=merchant&account_id=${this.state.id}${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.monzo_access_token}`
      }
    })
    .then(checkStatus)
    .then(response => response.json())
    .then(account => {
      const transactions = this.processTransactionsData(account.transactions).reverse()
      this.setState({ transactions });
    })
    .catch(error => ajaxFail(error, this.initialLoad.bind(this)));
  }

  transactionSelect(transactionId = 0) {
    this.setState({
      active: transactionId
    });
  }

  transactionSearch(event) {
    event.preventDefault();
    const search = event.target.value;

    if (search.length <= 0) {
      return this.setState({
        filterActive: false,
        filteredTransactions: []
      });
    }

    // Search merchant name, address category and notes
    const filteredTransactions = this.state.transactions.filter(transaction => (
      (transaction.merchant ? transaction.merchant.name.toLowerCase().includes(search.toLowerCase()) : false) ||
      (transaction.merchant ? transaction.merchant.address.formatted.toLowerCase().includes(search.toLowerCase()) : false) ||
      (transaction.merchant ? transaction.merchant.category.toLowerCase().includes(search.toLowerCase()) : false) ||
      (transaction.notes ? transaction.notes.toLowerCase().includes(search.toLowerCase()) : false)
    ));

    this.setState({
      filterActive: true,
      filteredTransactions
    });
  }

  render() {
    const {
      active,
      id,
      name,
      transactions,
      filterActive,
      filteredTransactions,
      balance,
      spentToday
    } = this.state;

    if (!localStorage.monzo_access_token) {
      browserHistory.push('/');
      return false;
    }

    const currentTransactions = filterActive ? filteredTransactions : transactions;

    let selectedTransaction = {};

    const transactionsLoaded = transactions.length >= 0;
    const transactionSelected = active !== 0;

    if (transactionsLoaded && transactionSelected) {
      selectedTransaction = transactions.find(t => t.id === active);
    }

    return (
      <div className="row">
        <div className="col s12 m12 l2">
          <AccountInfo
            name={name}
            balance={balance}
            spentToday={spentToday}
          />
        </div>
        <div className="col s12 m6 l6">
          <div className="border-box">
            <input onKeyUp={this.transactionSearch} placeholder="Search" autoFocus type="text" />
            <div className="grey-text text-lighten-1">You can search by location, merchant, category or notes</div>
          </div>
          <TransactionList
            transactionSelect={this.transactionSelect}
            transactions={currentTransactions}
            active={active}
          />
        </div>
        <div className="col s12 m6 l4">
          <TransactionSummary
            transaction={selectedTransaction}
            />
        </div>
      </div>
    );
  }
}
