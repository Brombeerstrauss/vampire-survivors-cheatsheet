using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using BepInEx.Logging;

namespace VSCheatsheetBridge;

// Minimaler HTTP-Server nur auf 127.0.0.1 (kein http.sys, keine Admin-Rechte nötig).
//   GET /state   aktueller Run als JSON
//   GET /events  Server-Sent Events: neuer Stand, sobald sich der Run ändert
//   GET /debug   Feldnamen der Spielobjekte (zum Anpassen nach Spiel-Updates)
// Läuft auf eigenen Threads und fasst das Spiel nie an, nur fertige Texte.
internal sealed class StateServer
{
    private readonly int _port;
    private readonly ManualLogSource _log;
    private TcpListener _listener;
    private volatile bool _running;

    private readonly object _lock = new();
    private string _key = "";
    private string _json = "{\"v\":1,\"inRun\":false,\"players\":[]}";
    private string _debug = "{}";
    private long _revision;

    public StateServer(int port, ManualLogSource log)
    {
        _port = port;
        _log = log;
    }

    public void Start()
    {
        try
        {
            _listener = new TcpListener(IPAddress.Loopback, _port);
            _listener.Start();
            _running = true;
            new Thread(AcceptLoop) { IsBackground = true, Name = "VSCheatsheetBridge" }.Start();
        }
        catch (Exception ex)
        {
            _log.LogError($"Server konnte Port {_port} nicht öffnen: {ex.Message}");
        }
    }

    public void Stop()
    {
        _running = false;
        try { _listener?.Stop(); } catch { }
    }

    public void Publish(string key, string json, string debug)
    {
        lock (_lock)
        {
            _debug = debug;
            if (key == _key) return;
            _key = key;
            _json = json;
            _revision++;
            Monitor.PulseAll(_lock);
        }
    }

    private void AcceptLoop()
    {
        while (_running)
        {
            try
            {
                TcpClient client = _listener.AcceptTcpClient();
                new Thread(() => Handle(client)) { IsBackground = true }.Start();
            }
            catch (Exception ex)
            {
                if (_running) _log.LogWarning("Accept: " + ex.Message);
            }
        }
    }

    private void Handle(TcpClient client)
    {
        using (client)
        {
            try
            {
                client.NoDelay = true;
                NetworkStream stream = client.GetStream();
                stream.ReadTimeout = 5000;
                var reader = new StreamReader(stream, Encoding.ASCII);
                string requestLine = reader.ReadLine();
                if (string.IsNullOrEmpty(requestLine)) return;
                string host = null;
                string line;
                while (!string.IsNullOrEmpty(line = reader.ReadLine()))
                {
                    if (line.StartsWith("Host:", StringComparison.OrdinalIgnoreCase)) host = line.Substring(5).Trim();
                }

                string[] parts = requestLine.Split(' ');
                string method = parts[0];
                string path = parts.Length > 1 ? parts[1].Split('?')[0] : "/";

                // Schutz gegen DNS-Rebinding: nur Anfragen an localhost/127.0.0.1 beantworten.
                if (host == null || !(host.StartsWith("127.0.0.1") || host.StartsWith("localhost")))
                {
                    Write(stream, "403 Forbidden", "text/plain", "forbidden");
                    return;
                }

                if (method == "OPTIONS") { Write(stream, "204 No Content", "text/plain", ""); return; }
                if (method != "GET") { Write(stream, "405 Method Not Allowed", "text/plain", "GET only"); return; }

                switch (path)
                {
                    case "/state":
                        string json;
                        lock (_lock) json = _json;
                        Write(stream, "200 OK", "application/json", json);
                        break;
                    case "/debug":
                        string debug;
                        lock (_lock) debug = _debug;
                        Write(stream, "200 OK", "application/json", debug);
                        break;
                    case "/events":
                        stream.ReadTimeout = Timeout.Infinite;
                        Events(stream);
                        break;
                    default:
                        Write(stream, "200 OK", "text/plain",
                            $"{Plugin.Name} {Plugin.Version}\nGET /state, /events, /debug\n");
                        break;
                }
            }
            catch (IOException) { }
            catch (ObjectDisposedException) { }
            catch (Exception ex) { _log.LogWarning("Request: " + ex.Message); }
        }
    }

    private void Events(NetworkStream stream)
    {
        WriteRaw(stream, "HTTP/1.1 200 OK\r\n" + Cors() +
            "Content-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: keep-alive\r\n\r\n");
        long seen = -1;
        while (_running)
        {
            string json = null;
            lock (_lock)
            {
                if (_revision == seen) Monitor.Wait(_lock, 15000);
                if (_revision != seen) { seen = _revision; json = _json; }
            }
            // Ohne Änderung ein Kommentar als Lebenszeichen, damit tote Verbindungen auffallen.
            WriteRaw(stream, json != null ? "data: " + json + "\n\n" : ": ping\n\n");
        }
    }

    private static string Cors() =>
        "Access-Control-Allow-Origin: *\r\n" +
        "Access-Control-Allow-Methods: GET, OPTIONS\r\n" +
        "Access-Control-Allow-Headers: *\r\n" +
        "Access-Control-Allow-Private-Network: true\r\n";

    private static void Write(NetworkStream stream, string status, string type, string body)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(body);
        WriteRaw(stream, $"HTTP/1.1 {status}\r\n" + Cors() +
            $"Content-Type: {type}; charset=utf-8\r\nContent-Length: {bytes.Length}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n");
        stream.Write(bytes, 0, bytes.Length);
    }

    private static void WriteRaw(NetworkStream stream, string text)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(text);
        stream.Write(bytes, 0, bytes.Length);
        stream.Flush();
    }
}
