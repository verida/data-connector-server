
# Command Line Interface

There is a collection of command line tools that can be accessed as follows:

```bash
yarn run cli --help
```

Output:

```bash
cli

  Verida Command Line Interface 

Synopsis

  cli 

Commands

  Connect         Connect to a third party data provider and save the credentials into the Verida:  
                  Vault context                                                                     
  Sync            Sync to a third party data provider and save the credentials into the Verida:     
                  Vault context                                                                     
  Data            Show data for a given schema                                                      
  ResetProvider   Clear all the data and reset sync positions for a provider                        
  help            Show help. 
```

You can get help on each command as follows:

```bash
yarn run cli Connect --help
```

Output:


```bash
cli

  Connect to a third party data provider and save the credentials into the      
  Verida: Vault context                                                         

Synopsis

  cli Connect --provider string [--key string --network string] 

Options

  -p, --provider string   Unique ID of the provider                   
  -k, --key string        Verida network private key (or seed phrase) 
  -n, --network string    Verida network (banksia, myrtle)
```