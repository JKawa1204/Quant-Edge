
--- arima2.ipynb ---
!pip install yfinance pmdarima --quiet

import os
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import math

from statsmodels.tsa.stattools import adfuller
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.arima.model import ARIMA
from pmdarima.arima import auto_arima

from sklearn.metrics import mean_squared_error, mean_absolute_error
import yfinance as yf

def test_stationarity(timeseries):
    rolmean = timeseries.rolling(12).mean()
    rolstd = timeseries.rolling(12).std()

    plt.plot(timeseries, color='blue',label='Original')
    plt.plot(rolmean, color='red', label='Rolling Mean')
    plt.plot(rolstd, color='black', label = 'Rolling Std')
    plt.legend(loc='best')
    plt.title('Rolling Mean and Standard Deviation')
    plt.show()

    print("Results of Dickey-Fuller Test")
    adft = adfuller(timeseries, autolag='AIC')
    output = pd.Series(adft[0:4],
        index=['Test Statistic','p-value','No. of lags used','Number of observations used'])
    for key,values in adft[4].items():
        output['critical value (%s)'%key] = values
    print(output)

tickers = ["RELIANCE.NS", "TCS.NS", "INFY.NS"]

for ticker in tickers:

    print("\n" + "="*60)
    print(f"ARIMA ANALYSIS FOR {ticker}")
    print("="*60)

    # -----------------------------
    # Load Data (yfinance instead of CSV)
    # -----------------------------
    stock_data = yf.download(ticker, start="2010-01-01")
    stock_data = stock_data[['Close']]
    stock_data.fillna(0, inplace=True)
    
    

    # -----------------------------
    # Plot Close Price
    # -----------------------------
    plt.figure(figsize=(10,6))
    plt.grid(True)
    plt.xlabel('Date')
    plt.ylabel('Close Prices')
    plt.plot(stock_data['Close'])
    plt.title(f'{ticker} Closing Price')
    plt.show()

    # -----------------------------
    # Distribution
    # -----------------------------
    df_close = stock_data['Close']
    df_close.plot(kind='kde', title=f"{ticker} Price Distribution")
    plt.show()

    # -----------------------------
    # Stationarity Test
    # -----------------------------
    test_stationarity(df_close)

    # -----------------------------
    # Seasonal Decomposition
    # -----------------------------
    result = seasonal_decompose(df_close, model='multiplicative', period=30)
    result.plot()
    plt.show()

    # -----------------------------
    # Log Transform + Moving Average
    # -----------------------------
    df_log = np.log(df_close)

    moving_avg = df_log.rolling(12).mean()
    std_dev = df_log.rolling(12).std()

    plt.figure(figsize=(10,6))
    plt.plot(std_dev, color="black", label="Standard Deviation")
    plt.plot(moving_avg, color="red", label="Mean")
    plt.legend()
    plt.title("Moving Average")
    plt.show()

    # -----------------------------
    # Train-Test Split
    # -----------------------------
    train_data = df_log[3:int(len(df_log)*0.9)]
    test_data = df_log[int(len(df_log)*0.9):]

    plt.figure(figsize=(10,6))
    plt.grid(True)
    plt.xlabel('Dates')
    plt.ylabel('Closing Prices')
    plt.plot(train_data, 'green', label='Train data')
    plt.plot(test_data, 'blue', label='Test data')
    plt.legend()
    plt.show()

    # -----------------------------
    # Auto ARIMA
    # -----------------------------
    model_autoARIMA = auto_arima(
        train_data,
        start_p=0, start_q=0,
        test='adf',
        max_p=3, max_q=3,
        m=1,
        d=None,
        seasonal=False,
        start_P=0,
        D=0,
        trace=True,
        error_action='ignore',
        suppress_warnings=True,
        stepwise=True
    )

    print(model_autoARIMA.summary())
    model_autoARIMA.plot_diagnostics(figsize=(15,8))
    plt.show()

    # -----------------------------
    # Build ARIMA Model
    # -----------------------------
    model = ARIMA(train_data, order=model_autoARIMA.order)
    fitted = model.fit()
    print(fitted.summary())

    # -----------------------------
    # Forecast (MODERN API, NO LOGIC CHANGE)
    # -----------------------------
    forecast_obj = fitted.get_forecast(steps=len(test_data))
    fc = forecast_obj.predicted_mean
    conf = forecast_obj.conf_int()

    fc.index = test_data.index
    conf.index = test_data.index

    # -----------------------------
    # Plot Forecast
    # -----------------------------
    plt.figure(figsize=(10,5), dpi=100)
    plt.plot(train_data, label='training data')
    plt.plot(test_data, color='blue', label='Actual Stock Price')
    plt.plot(fc, color='orange', label='Predicted Stock Price')
    plt.fill_between(
        conf.index,
        conf.iloc[:,0],
        conf.iloc[:,1],
        color='k',
        alpha=.10
    )
    plt.title(f'{ticker} Stock Price Prediction')
    plt.xlabel('Time')
    plt.ylabel('Log Price')
    plt.legend(loc='upper left', fontsize=8)
    plt.show()

    # -----------------------------
    # Performance Metrics (UNCHANGED)
    # -----------------------------
    mse = mean_squared_error(test_data, fc)
    mae = mean_absolute_error(test_data, fc)
    rmse = math.sqrt(mse)
    mape = np.mean(np.abs(fc - test_data)/np.abs(test_data))

    print("MSE :", mse)
    print("MAE :", mae)
    print("RMSE:", rmse)
    print("MAPE:", mape)

results_df = pd.DataFrame(results).T
results_df

--- lstm.ipynb ---
!pip install yfinance torch --quiet

import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

import torch
import torch.nn as nn

from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

import yfinance as yf

class LSTMModel(nn.Module):
    def __init__(self, n_features, hidden=64):
        super().__init__()
        self.lstm = nn.LSTM(n_features, hidden, batch_first=True)
        self.fc = nn.Linear(hidden, n_features)

    def forward(self, x):
        _, (h, _) = self.lstm(x)
        return self.fc(h[-1])

def create_sequences(data, window=30):
    X, y = [], []
    for i in range(window, len(data)):
        X.append(data[i-window:i])
        y.append(data[i])
    return np.array(X), np.array(y)

tickers = ["RELIANCE.NS", "TCS.NS", "INFY.NS"]

for ticker in tickers:

    print("\n" + "="*60)
    print(f"LSTM MODEL FOR {ticker}")
    print("="*60)

    # -----------------------------
    # Data Download
    # -----------------------------
    df = yf.download(ticker, start="2010-01-01")
    df = df[['Open','High','Low','Close','Volume']]
    df.dropna(inplace=True)
    
    
    print(f"EDA for {ticker} started.")
    
    
    print("\n--- BASIC INFO ---")
    print(df.info())

    print("\n--- FIRST 5 ROWS ---")
    display(df.head())

    print("\n--- LAST 5 ROWS ---")
    display(df.tail())
    
    print("\n--- MISSING VALUES ---")
    print(df.isnull().sum())
    
    df = df.dropna()

    
    plt.figure(figsize=(12,6))
    plt.plot(df['Open'], label='Open', alpha=0.7)
    plt.plot(df['High'], label='High', alpha=0.7)
    plt.plot(df['Low'], label='Low', alpha=0.7)
    plt.plot(df['Close'], label='Close', linewidth=2)
    plt.title(f"{ticker} OHLC Prices")
    plt.xlabel("Date")
    plt.ylabel("Price")
    plt.legend()
    plt.grid(True)
    plt.show()
    
    plt.figure(figsize=(12,4))
    plt.plot(df['Volume'], color='purple')
    plt.title(f"{ticker} Trading Volume")
    plt.xlabel("Date")
    plt.ylabel("Volume")
    plt.grid(True)
    plt.show()
    
    plt.figure(figsize=(6,4))
    df['Close'].plot(kind='kde')
    plt.title(f"{ticker} Close Price Distribution")
    plt.grid(True)
    plt.show()
    
    returns = df['Close'].pct_change().dropna()

    plt.figure(figsize=(10,4))
    plt.plot(returns, color='teal')
    plt.title(f"{ticker} Daily Returns")
    plt.xlabel("Date")
    plt.ylabel("Return")
    plt.grid(True)
    plt.show()

    print(f"EDA completed for {ticker}. Proceeding to model training...")
    df = df[['Open','High','Low','Close']]

    # -----------------------------
    # Return-based preprocessing (AS IN YOUR CODE)
    # -----------------------------
    returns = df.pct_change().dropna()

    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(returns)

    # -----------------------------
    # Create sequences
    # -----------------------------
    X, y = create_sequences(scaled, window=30)

    X = torch.tensor(X, dtype=torch.float32)
    y = torch.tensor(y, dtype=torch.float32)

    # -----------------------------
    # Train-Test Split
    # -----------------------------
    split = int(0.8 * len(X))
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    # -----------------------------
    # Model + Training (UNCHANGED)
    # -----------------------------
    model = LSTMModel(X.shape[2])
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

    for epoch in range(20):
        optimizer.zero_grad()
        preds = model(X_train)
        loss = criterion(preds, y_train)
        loss.backward()
        optimizer.step()

        if epoch % 5 == 0:
            print(f"Epoch {epoch}, Loss: {loss.item()}")

    # -----------------------------
    # Evaluation
    # -----------------------------
    model.eval()
    with torch.no_grad():
        preds = model(X_test).numpy()
        actual = y_test.numpy()

    rmse = np.sqrt(mean_squared_error(actual, preds))
    mae = mean_absolute_error(actual, preds)
    r2 = r2_score(actual, preds)

    directional_accuracy = np.mean(
        np.sign(actual) == np.sign(preds)
    )

    print("RMSE:", rmse)
    print("MAE:", mae)
    print("R2:", r2)
    print("Directional Accuracy:", directional_accuracy)

    # -----------------------------
    # PLOT (ARIMA-STYLE, CLEAN)
    # -----------------------------
    # Plot only CLOSE return (index 3)
    plt.figure(figsize=(10,5))
    plt.plot(
        actual[:,3],
        label="Actual Returns",
        color="blue"
    )
    plt.plot(
        preds[:,3],
        label="Predicted Returns",
        color="orange",
        linestyle="--"
    )
    plt.title(f"{ticker} LSTM Return Prediction")
    plt.xlabel("Time")
    plt.ylabel("Scaled Return")
    plt.legend()
    plt.grid(True)
    plt.show()

--- xgboost.ipynb ---
!pip install yfinance xgboost --quiet

import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

import yfinance as yf
import xgboost as xgb

from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

def create_features(df):
    df = df.copy()

    df['Return'] = df['Close'].pct_change()
    df['Lag_1'] = df['Return'].shift(1)
    df['Lag_2'] = df['Return'].shift(2)
    df['Lag_3'] = df['Return'].shift(3)

    df['MA_5'] = df['Close'].rolling(5).mean()
    df['MA_10'] = df['Close'].rolling(10).mean()

    df['Volatility'] = df['Return'].rolling(10).std()

    df.dropna(inplace=True)
    return df

tickers = ["RELIANCE.NS", "TCS.NS", "INFY.NS"]

for ticker in tickers:

    print("\n" + "="*60)
    print(f"XGBOOST MODEL FOR {ticker}")
    print("="*60)

    # -----------------------------
    # Data Download
    # -----------------------------
    df = yf.download(ticker, start="2010-01-01")
    df = df[['Open','High','Low','Close','Volume']]
    df.dropna(inplace=True)
    
    print(f"EDA for {ticker} started.")
    
    
    print("\n--- BASIC INFO ---")
    print(df.info())

    print("\n--- FIRST 5 ROWS ---")
    display(df.head())

    print("\n--- LAST 5 ROWS ---")
    display(df.tail())
    
    print("\n--- MISSING VALUES ---")
    print(df.isnull().sum())
    
    df = df.dropna()

    
    plt.figure(figsize=(12,6))
    plt.plot(df['Open'], label='Open', alpha=0.7)
    plt.plot(df['High'], label='High', alpha=0.7)
    plt.plot(df['Low'], label='Low', alpha=0.7)
    plt.plot(df['Close'], label='Close', linewidth=2)
    plt.title(f"{ticker} OHLC Prices")
    plt.xlabel("Date")
    plt.ylabel("Price")
    plt.legend()
    plt.grid(True)
    plt.show()
    
    plt.figure(figsize=(12,4))
    plt.plot(df['Volume'], color='purple')
    plt.title(f"{ticker} Trading Volume")
    plt.xlabel("Date")
    plt.ylabel("Volume")
    plt.grid(True)
    plt.show()
    
    plt.figure(figsize=(6,4))
    df['Close'].plot(kind='kde')
    plt.title(f"{ticker} Close Price Distribution")
    plt.grid(True)
    plt.show()
    
    returns = df['Close'].pct_change().dropna()

    plt.figure(figsize=(10,4))
    plt.plot(returns, color='teal')
    plt.title(f"{ticker} Daily Returns")
    plt.xlabel("Date")
    plt.ylabel("Return")
    plt.grid(True)
    plt.show()

    print(f"EDA completed for {ticker}. Proceeding to model training...")


    # -----------------------------
    # Feature Engineering
    # -----------------------------
    df_feat = create_features(df)

    X = df_feat.drop(columns=['Close'])
    y = df_feat['Close']   # price prediction (same spirit as ARIMA)

    # -----------------------------
    # Train-Test Split (TIME-BASED)
    # -----------------------------
    split = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split], X.iloc[split:]
    y_train, y_test = y.iloc[:split], y.iloc[split:]

    # -----------------------------
    # XGBoost Model (STANDARD)
    # -----------------------------
    model = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective='reg:squarederror'
    )

    model.fit(X_train, y_train)

    # -----------------------------
    # Prediction
    # -----------------------------
    preds = model.predict(X_test)

    # -----------------------------
    # Metrics
    # -----------------------------
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    mae = mean_absolute_error(y_test, preds)
    r2 = r2_score(y_test, preds)

    print("RMSE:", rmse)
    print("MAE :", mae)
    print("R2  :", r2)

    # -----------------------------
    # Plot (ARIMA-STYLE, CLEAN)
    # -----------------------------
    plt.figure(figsize=(10,5))
    plt.plot(y_test.index, y_test, label="Actual Price", color="blue")
    plt.plot(y_test.index, preds, label="Predicted Price", color="orange", linestyle="--")
    plt.title(f"{ticker} XGBoost Stock Price Prediction")
    plt.xlabel("Date")
    plt.ylabel("Price")
    plt.legend()
    plt.grid(True)
    plt.show()

