using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;

namespace DOMScopeLauncher
{
    class Program
    {
        private static Process serverProcess = null;
        private static readonly object lockObj = new object();
        private static bool isStopping = false;

        static void Main(string[] args)
        {
            Console.Title = "DOMScope - Website Intelligence Platform";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("====================================================================");
            Console.WriteLine("  [+] DOMScope - Website Intelligence Platform");
            Console.WriteLine("====================================================================");
            Console.ResetColor();

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string nodePath = FindNodeExecutable(baseDir);

            if (string.IsNullOrEmpty(nodePath))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[-] Error: Node.js executable could not be found.");
                Console.WriteLine("    Please place 'node.exe' in this folder or install Node.js.");
                Console.ResetColor();
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
                return;
            }

            string serverJsPath = Path.Combine(baseDir, "server.js");
            if (!File.Exists(serverJsPath))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[-] Error: 'server.js' not found in: " + baseDir);
                Console.ResetColor();
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
                return;
            }

            int port = GetConfiguredPort();
            if (!IsPortAvailable(port))
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("[!] Warning: Port " + port + " is already in use.");
                int fallbackPort = FindAvailablePort(port + 1);
                Console.WriteLine("[*] Switching to available port: " + fallbackPort);
                Console.ResetColor();
                port = fallbackPort;
            }

            Console.WriteLine("[*] Starting DOMScope server on port " + port + "...");

            Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs e)
            {
                e.Cancel = true;
                StopServer();
                Environment.Exit(0);
            };

            AppDomain.CurrentDomain.ProcessExit += delegate(object sender, EventArgs e)
            {
                StopServer();
            };

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodePath;
                psi.Arguments = "\"" + serverJsPath + "\"";
                psi.WorkingDirectory = baseDir;
                psi.UseShellExecute = false;
                psi.RedirectStandardOutput = false;
                psi.RedirectStandardError = false;

                psi.EnvironmentVariables["PORT"] = port.ToString();
                psi.EnvironmentVariables["NODE_ENV"] = "production";
                psi.EnvironmentVariables["HOSTNAME"] = "127.0.0.1";

                serverProcess = Process.Start(psi);

                if (serverProcess == null)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("[-] Failed to start Node process.");
                    Console.ResetColor();
                    return;
                }

                string url = "http://localhost:" + port;
                bool isReady = WaitForServerReady(port, 25);

                if (isReady)
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("====================================================================");
                    Console.WriteLine("  [✓] DOMScope is up and running!");
                    Console.WriteLine("  [→] Local URL: " + url);
                    Console.WriteLine("  [→] Opening browser automatically...");
                    Console.WriteLine("  [i] Press Ctrl+C or close this window to stop.");
                    Console.WriteLine("====================================================================");
                    Console.ResetColor();

                    OpenBrowser(url);
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("[!] Server started. Visit: " + url);
                    Console.ResetColor();
                }

                serverProcess.WaitForExit();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[-] Error launching DOMScope: " + ex.Message);
                Console.ResetColor();
            }
            finally
            {
                StopServer();
            }
        }

        private static string FindNodeExecutable(string baseDir)
        {
            string localNode = Path.Combine(baseDir, "node.exe");
            if (File.Exists(localNode)) return localNode;

            string localBinNode = Path.Combine(baseDir, "bin", "node.exe");
            if (File.Exists(localBinNode)) return localBinNode;

            string pathEnv = Environment.GetEnvironmentVariable("PATH");
            if (!string.IsNullOrEmpty(pathEnv))
            {
                string[] paths = pathEnv.Split(';');
                foreach (string p in paths)
                {
                    string candidate = Path.Combine(p.Trim(), "node.exe");
                    if (File.Exists(candidate)) return candidate;
                }
            }

            return null;
        }

        private static int GetConfiguredPort()
        {
            string envPort = Environment.GetEnvironmentVariable("PORT");
            int p;
            if (!string.IsNullOrEmpty(envPort) && int.TryParse(envPort, out p))
            {
                return p;
            }
            return 3000;
        }

        private static bool IsPortAvailable(int port)
        {
            try
            {
                TcpListener listener = new TcpListener(IPAddress.Loopback, port);
                listener.Start();
                listener.Stop();
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static int FindAvailablePort(int startPort)
        {
            for (int p = startPort; p <= 65535; p++)
            {
                if (IsPortAvailable(p)) return p;
            }
            return startPort;
        }

        private static bool WaitForServerReady(int port, int timeoutSeconds)
        {
            int elapsed = 0;
            while (elapsed < timeoutSeconds * 10)
            {
                if (serverProcess != null && serverProcess.HasExited)
                {
                    return false;
                }

                try
                {
                    using (TcpClient client = new TcpClient())
                    {
                        IAsyncResult result = client.BeginConnect("127.0.0.1", port, null, null);
                        bool success = result.AsyncWaitHandle.WaitOne(300);
                        if (success && client.Connected)
                        {
                            client.EndConnect(result);
                            return true;
                        }
                    }
                }
                catch
                {
                }

                Thread.Sleep(200);
                elapsed += 2;
            }
            return false;
        }

        private static void OpenBrowser(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch
            {
                try
                {
                    Process.Start("cmd.exe", "/c start " + url);
                }
                catch { }
            }
        }

        private static void StopServer()
        {
            lock (lockObj)
            {
                if (isStopping) return;
                isStopping = true;

                if (serverProcess != null && !serverProcess.HasExited)
                {
                    try
                    {
                        Console.WriteLine("\n[*] Stopping DOMScope server...");
                        KillProcessTree(serverProcess.Id);
                    }
                    catch { }
                }
            }
        }

        private static void KillProcessTree(int pid)
        {
            try
            {
                Process killer = new Process();
                killer.StartInfo.FileName = "taskkill";
                killer.StartInfo.Arguments = "/F /T /PID " + pid;
                killer.StartInfo.CreateNoWindow = true;
                killer.StartInfo.UseShellExecute = false;
                killer.Start();
                killer.WaitForExit(3000);
            }
            catch { }
        }
    }
}
