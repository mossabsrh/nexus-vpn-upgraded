<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment successful</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f4f7fb;
            margin: 0;
            display: grid;
            place-items: center;
            min-height: 100vh;
            color: #1f2937;
        }
        .card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
            padding: 40px 48px;
            text-align: center;
            max-width: 560px;
            width: 90%;
        }
        .badge {
            display: inline-grid;
            place-items: center;
            width: 90px;
            height: 90px;
            border-radius: 50%;
            background: #dcfce7;
            color: #16a34a;
            font-size: 44px;
            margin-bottom: 20px;
        }
        h1 {
            margin: 0 0 12px;
            font-size: 42px;
            color: #10b981;
        }
        p {
            margin: 8px 0;
            font-size: 16px;
        }
        .btn {
            display: inline-block;
            margin-top: 24px;
            padding: 14px 28px;
            border-radius: 10px;
            background: #10b981;
            color: white;
            text-decoration: none;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">✓</div>
        <h1>Payment successful</h1>
        <p>Thank you for your payment.</p>
        <p>Payment ID: {{ $payment_id ?? 'N/A' }}</p>
        <a class="btn" href="{{ env('APP_FRONTEND_URL', url('/dashboard')) }}">Return to My app</a>
    </div>
</body>
</html>
